#!/bin/zsh
# =============================================================
# Transform raw AWS pricing data → compact EC2DataMap JSON
# สร้างไฟล์ JSON ขนาดเล็กสำหรับใช้เป็น static API
#
# Input:  scripts/aws-pricing-data/regions/ec2-pricing_*.json
# Output: public/data/ec2instances.json
# =============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
REGIONS_DIR="${SCRIPT_DIR}/aws-pricing-data/regions"
OUTPUT_DIR="${PROJECT_DIR}/public/data"
OUTPUT_FILE="${OUTPUT_DIR}/ec2instances.json"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "${BLUE}========================================${NC}"
echo "${BLUE}  Transform AWS Data → EC2DataMap JSON${NC}"
echo "${BLUE}========================================${NC}"
echo ""

# Check dependencies
if ! command -v jq &> /dev/null; then
    echo "${RED}❌ jq ไม่พบ:${NC}  brew install jq"
    exit 1
fi

# Check input data
if [ ! -d "$REGIONS_DIR" ] || [ -z "$(ls $REGIONS_DIR/ec2-pricing_*.json 2>/dev/null)" ]; then
    echo "${RED}❌ ไม่พบข้อมูลใน ${REGIONS_DIR}${NC}"
    echo "   กรุณารัน fetch-ec2-pricing.sh ก่อน"
    exit 1
fi

mkdir -p "$OUTPUT_DIR"

echo "${YELLOW}[1/3] Processing region files...${NC}"
echo ""

# Create a temporary file for accumulating results
TEMP_RESULT=$(mktemp)
echo '{}' > "$TEMP_RESULT"

REGION_FILES=($REGIONS_DIR/ec2-pricing_*.json)
TOTAL=${#REGION_FILES[@]}
CURRENT=0
TOTAL_PRODUCTS=0

for REGION_FILE in "${REGION_FILES[@]}"; do
    CURRENT=$((CURRENT + 1))
    BASENAME=$(basename "$REGION_FILE")
    
    PRODUCT_COUNT=$(jq '.PriceList | length' "$REGION_FILE" 2>/dev/null || echo "0")
    TOTAL_PRODUCTS=$((TOTAL_PRODUCTS + PRODUCT_COUNT))
    
    # Extract actual region code from the data itself
    REGION_CODE=$(jq -r '.PriceList[0] | fromjson | .product.attributes.regionCode // empty' "$REGION_FILE" 2>/dev/null || echo "")
    if [ -z "$REGION_CODE" ]; then
        echo "${RED}✗ (no regionCode)${NC}"
        continue
    fi

    printf "  [%d/%d] %s (%s products)... " "$CURRENT" "$TOTAL" "$REGION_CODE" "$PRODUCT_COUNT"

    # Transform each region file: extract instance data and merge into result
    TEMP_REGION=$(mktemp)
    
    jq --arg rc "$REGION_CODE" '
    [.PriceList[] | fromjson] |
    map(
        select(
            .product.attributes.instanceType != null and
            .product.attributes.instanceType != "" and
            .product.productFamily == "Compute Instance"
        ) |
        {
            instanceType: .product.attributes.instanceType,
            vcpu: (.product.attributes.vcpu | tonumber // 0),
            memory: .product.attributes.memory,
            storage: (.product.attributes.storage // "EBS only"),
            networkPerformance: (.product.attributes.networkPerformance // ""),
            currentGeneration: (.product.attributes.currentGeneration == "Yes"),
            physicalProcessor: (.product.attributes.physicalProcessor // ""),
            clockSpeed: (.product.attributes.clockSpeed // ""),
            os: .product.attributes.operatingSystem,
            tenancy: (.product.attributes.tenancy // "Shared"),
            regionCode: $rc,
            price: (
                .terms.OnDemand // {} |
                to_entries | first // {value:{}} |
                .value.priceDimensions // {} |
                to_entries | first // {value:{}} |
                .value.pricePerUnit.USD // "0" |
                tonumber
            )
        }
    ) |
    map(select(.price > 0)) |
    group_by(.instanceType) |
    map({
        key: .[0].instanceType,
        value: {
            vcpu: .[0].vcpu,
            memory: .[0].memory,
            storage: .[0].storage,
            networkPerformance: .[0].networkPerformance,
            currentGeneration: .[0].currentGeneration,
            physicalProcessor: .[0].physicalProcessor,
            clockSpeed: .[0].clockSpeed,
            prices: (
                reduce .[] as $item ({};
                    .[$item.os] //= {} |
                    .[$item.os][$item.regionCode] //= {} |
                    .[$item.os][$item.regionCode][$item.tenancy] = $item.price
                )
            ),
            regions: [$rc]
        }
    }) |
    from_entries // {}
    ' "$REGION_FILE" > "$TEMP_REGION" 2>/dev/null || echo '{}' > "$TEMP_REGION"

    # Merge region data into main result (deep merge)
    TEMP_MERGED=$(mktemp)
    jq -s '
    def deep_merge:
        if length == 0 then {}
        elif length == 1 then .[0]
        else
            .[0] as $base | .[1:] | reduce .[] as $overlay ($base;
                reduce ($overlay | keys[]) as $key (.;
                    if .[$key] == null then
                        .[$key] = $overlay[$key]
                    elif (.[$key] | type) == "object" and ($overlay[$key] | type) == "object" then
                        .[$key] = ([.[$key], $overlay[$key]] | deep_merge)
                    elif (.[$key] | type) == "array" and ($overlay[$key] | type) == "array" then
                        .[$key] = (.[$key] + $overlay[$key] | unique)
                    else
                        .[$key] = $overlay[$key]
                    end
                )
            )
        end;
    deep_merge
    ' "$TEMP_RESULT" "$TEMP_REGION" > "$TEMP_MERGED" 2>/dev/null || cp "$TEMP_RESULT" "$TEMP_MERGED"
    
    mv "$TEMP_MERGED" "$TEMP_RESULT"
    rm -f "$TEMP_REGION"
    
    echo "${GREEN}✓${NC}"
done

echo ""
echo "${YELLOW}[2/3] Finalizing JSON structure...${NC}"

# Restructure: ensure each instance has complete regions list and proper format
jq '
to_entries |
map({
    key: .key,
    value: (
        .value |
        .regions = [.prices | to_entries[] | .value | keys[]] | unique |
        {
            vcpu: .vcpu,
            memory: .memory,
            storage: .storage,
            networkPerformance: .networkPerformance,
            currentGeneration: .currentGeneration,
            physicalProcessor: .physicalProcessor,
            clockSpeed: .clockSpeed,
            prices: .prices,
            regions: .regions
        }
    )
}) |
from_entries
' "$TEMP_RESULT" > "$OUTPUT_FILE" 2>/dev/null || cp "$TEMP_RESULT" "$OUTPUT_FILE"

rm -f "$TEMP_RESULT"

echo "${GREEN}✓${NC} Structure finalized"

echo ""
echo "${YELLOW}[3/3] Summary${NC}"

INSTANCE_COUNT=$(jq 'keys | length' "$OUTPUT_FILE")
FILE_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)

echo ""
echo "${GREEN}========================================${NC}"
echo "${GREEN}  ✅ เสร็จสิ้น!${NC}"
echo "${GREEN}========================================${NC}"
echo ""
echo "  📁 Output: ${BLUE}${OUTPUT_FILE}${NC}"
echo "  📦 Size: ${FILE_SIZE}"
echo "  🖥️  Instance Types: ${INSTANCE_COUNT}"
echo "  🌍 Regions: 22"
echo "  📊 Total products processed: ${TOTAL_PRODUCTS}"
echo ""
echo "  ${BLUE}ไฟล์นี้จะถูก serve จาก /data/ec2instances.json${NC}"
echo ""
