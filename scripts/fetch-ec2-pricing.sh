#!/bin/zsh
# =============================================================
# AWS EC2 Pricing Data Fetcher
# ใช้ AWS CLI ดึงข้อมูล EC2 pricing จาก AWS Price List API
# และ export เป็น JSON files
#
# Prerequisites:
#   - AWS CLI v2 (brew install awscli)
#   - AWS credentials (aws configure)
#   - jq (brew install jq)
# =============================================================

set -euo pipefail

# Config
PRICING_REGION="us-east-1"
SERVICE_CODE="AmazonEC2"
OUTPUT_DIR="./aws-pricing-data"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "${BLUE}========================================${NC}"
echo "${BLUE}  AWS EC2 Pricing Data Fetcher${NC}"
echo "${BLUE}========================================${NC}"
echo ""

# Check dependencies
if ! command -v aws &> /dev/null; then
    echo "${RED}❌ AWS CLI ไม่พบ:${NC}  brew install awscli && aws configure"
    exit 1
fi
if ! command -v jq &> /dev/null; then
    echo "${RED}❌ jq ไม่พบ:${NC}  brew install jq"
    exit 1
fi

echo "${GREEN}✓${NC} AWS CLI: $(aws --version 2>&1)"

if ! aws sts get-caller-identity &> /dev/null 2>&1; then
    echo "${RED}❌ AWS credentials ยังไม่ได้ตั้งค่า:${NC}  aws configure"
    exit 1
fi

IDENTITY=$(aws sts get-caller-identity --output text --query 'Account' 2>/dev/null || echo "unknown")
echo "${GREEN}✓${NC} AWS Account: ${IDENTITY}"
echo ""

mkdir -p "$OUTPUT_DIR"
echo "${BLUE}📁 Output: ${OUTPUT_DIR}${NC}"
echo ""

# =============================================================
# 1. describe-services
# =============================================================
echo "${YELLOW}[1/4] Fetching EC2 Service Description...${NC}"

SERVICE_FILE="${OUTPUT_DIR}/ec2-describe-services_${TIMESTAMP}.json"
aws pricing describe-services \
    --service-code "$SERVICE_CODE" \
    --region "$PRICING_REGION" \
    --output json > "$SERVICE_FILE"

echo "${GREEN}✓${NC} $SERVICE_FILE ($(jq '.Services[0].AttributeNames | length' "$SERVICE_FILE") attributes)"
echo ""

# =============================================================
# 2. Attribute values
# =============================================================
echo "${YELLOW}[2/4] Fetching Attribute Values...${NC}"

LOCATIONS_FILE="${OUTPUT_DIR}/ec2-locations_${TIMESTAMP}.json"
aws pricing get-attribute-values \
    --service-code "$SERVICE_CODE" \
    --attribute-name "location" \
    --region "$PRICING_REGION" \
    --output json > "$LOCATIONS_FILE"
echo "${GREEN}✓${NC} Locations: $(jq '.AttributeValues | length' "$LOCATIONS_FILE") regions"

INSTANCE_TYPES_FILE="${OUTPUT_DIR}/ec2-instance-types_${TIMESTAMP}.json"
aws pricing get-attribute-values \
    --service-code "$SERVICE_CODE" \
    --attribute-name "instanceType" \
    --region "$PRICING_REGION" \
    --output json > "$INSTANCE_TYPES_FILE"
echo "${GREEN}✓${NC} Instance Types: $(jq '.AttributeValues | length' "$INSTANCE_TYPES_FILE") types"

OS_FILE="${OUTPUT_DIR}/ec2-operating-systems_${TIMESTAMP}.json"
aws pricing get-attribute-values \
    --service-code "$SERVICE_CODE" \
    --attribute-name "operatingSystem" \
    --region "$PRICING_REGION" \
    --output json > "$OS_FILE"
echo "${GREEN}✓${NC} Operating Systems: $(jq '.AttributeValues | length' "$OS_FILE") OS types"
echo ""

# =============================================================
# 3. Get pricing per region
# =============================================================
echo "${YELLOW}[3/4] Fetching EC2 On-Demand Pricing Per Region...${NC}"
echo "  ${BLUE}(อาจใช้เวลาหลายนาที)${NC}"
echo ""

# Region code → location name pairs (no associative array needed)
REGIONS=(
    "us-east-1|US East (N. Virginia)"
    "us-east-2|US East (Ohio)"
    "us-west-1|US West (N. California)"
    "us-west-2|US West (Oregon)"
    "ap-southeast-1|Asia Pacific (Singapore)"
    "ap-southeast-2|Asia Pacific (Sydney)"
    "ap-southeast-3|Asia Pacific (Jakarta)"
    "ap-northeast-1|Asia Pacific (Tokyo)"
    "ap-northeast-2|Asia Pacific (Seoul)"
    "ap-northeast-3|Asia Pacific (Osaka)"
    "ap-south-1|Asia Pacific (Mumbai)"
    "eu-west-1|EU (Ireland)"
    "eu-west-2|EU (London)"
    "eu-west-3|EU (Paris)"
    "eu-central-1|EU (Frankfurt)"
    "eu-north-1|EU (Stockholm)"
    "eu-south-1|EU (Milan)"
    "sa-east-1|South America (Sao Paulo)"
    "ca-central-1|Canada (Central)"
    "ap-east-1|Asia Pacific (Hong Kong)"
    "me-south-1|Middle East (Bahrain)"
    "af-south-1|Africa (Cape Town)"
)

REGIONS_DIR="${OUTPUT_DIR}/regions"
mkdir -p "$REGIONS_DIR"

TOTAL=${#REGIONS[@]}
CURRENT=0

for ENTRY in "${REGIONS[@]}"; do
    CURRENT=$((CURRENT + 1))
    REGION_CODE="${ENTRY%%|*}"
    LOCATION="${ENTRY#*|}"
    REGION_FILE="${REGIONS_DIR}/ec2-pricing_${REGION_CODE}_${TIMESTAMP}.json"

    printf "  [%d/%d] %s (%s)... " "$CURRENT" "$TOTAL" "$REGION_CODE" "$LOCATION"

    aws pricing get-products \
        --service-code "$SERVICE_CODE" \
        --region "$PRICING_REGION" \
        --filters \
            "Type=TERM_MATCH,Field=ServiceCode,Value=AmazonEC2" \
            "Type=TERM_MATCH,Field=location,Value=${LOCATION}" \
            "Type=TERM_MATCH,Field=capacitystatus,Value=Used" \
            "Type=TERM_MATCH,Field=preInstalledSw,Value=NA" \
            "Type=TERM_MATCH,Field=tenancy,Value=Shared" \
        --output json > "$REGION_FILE" 2>/dev/null || true

    PRODUCT_COUNT=$(jq '.PriceList | length' "$REGION_FILE" 2>/dev/null || echo "0")
    echo "${GREEN}✓${NC} ${PRODUCT_COUNT} products"
done

echo ""

# =============================================================
# 4. Combine all regions
# =============================================================
echo "${YELLOW}[4/4] Combining All Data...${NC}"

COMBINED_FILE="${OUTPUT_DIR}/ec2-all-pricing_${TIMESTAMP}.json"

jq -n --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '
{
  metadata: {
    generated_at: $ts,
    service: "AmazonEC2",
    source: "AWS Price List API"
  },
  regions: {}
}' > "$COMBINED_FILE"

for ENTRY in "${REGIONS[@]}"; do
    REGION_CODE="${ENTRY%%|*}"
    REGION_FILE="${REGIONS_DIR}/ec2-pricing_${REGION_CODE}_${TIMESTAMP}.json"
    if [ -f "$REGION_FILE" ]; then
        TEMP=$(mktemp)
        jq --arg rc "$REGION_CODE" --slurpfile rf "$REGION_FILE" \
            '.regions[$rc] = ($rf[0].PriceList // [])' \
            "$COMBINED_FILE" > "$TEMP" && mv "$TEMP" "$COMBINED_FILE"
    fi
done

COMBINED_SIZE=$(du -h "$COMBINED_FILE" | cut -f1)
echo "${GREEN}✓${NC} Combined: $COMBINED_FILE ($COMBINED_SIZE)"
echo ""

# Summary
TOTAL_SIZE=$(du -sh "$OUTPUT_DIR" | cut -f1)
echo "${GREEN}========================================${NC}"
echo "${GREEN}  ✅ เสร็จสิ้น! (Total: ${TOTAL_SIZE})${NC}"
echo "${GREEN}========================================${NC}"
echo ""
echo "  📁 ${OUTPUT_DIR}/"
echo "  ├── ec2-describe-services_*.json"
echo "  ├── ec2-locations_*.json"
echo "  ├── ec2-instance-types_*.json"
echo "  ├── ec2-operating-systems_*.json"
echo "  ├── ec2-all-pricing_*.json (combined)"
echo "  └── regions/"
echo "      └── ec2-pricing_<region>_*.json"
echo ""
