import EC2Calculator from "@/components/EC2Calculator";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <nav className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-orange-500 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="bg-orange-500/20 p-2 rounded-xl">
                <span className="text-2xl">☁️</span>
              </div>
              <div>
                <span className="font-semibold text-lg tracking-tight block leading-tight">
                  AWS EC2 Pricing Calculator
                </span>
                <span className="text-xs text-gray-400">
                  เครื่องมือคำนวณราคา EC2 แบบเรียลไทม์
                </span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        <EC2Calculator />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-4 mt-auto text-center text-xs text-gray-400">
        <p>
          ข้อมูลราคาจาก{" "}
          <a
            href="https://github.com/tedivm/ec2details"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            ec2details API
          </a>{" "}
          — ราคา On-Demand เป็นข้อมูลจริง, RI/SP เป็นค่าประมาณอัตราส่วนลดมาตรฐาน
        </p>
      </footer>
    </div>
  );
}
