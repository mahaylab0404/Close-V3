
import { useState, type FC } from 'react';

const RESOURCES = [
  { name: "Caring Transitions", category: "Relocation & Estate Sales", zip: "All S. Florida", phone: "(844) 220-5427", description: "Specialists in helping seniors declutter, downsize, and manage estate transitions with dignity." },
  { name: "SHINE Florida", category: "Medicare & Insurance", zip: "Florida Statewide", phone: "1-800-963-5337", description: "Serving Health Insurance Needs of Elders - free, unbiased counseling for South Florida residents." },
  { name: "SoFIA (South Florida Institute on Aging)", category: "Community Support", zip: "Broward/Dade", phone: "(954) 484-7117", description: "Provides social and economic support to seniors to ensure aging in place is successful." },
  { name: "EHDOC", category: "Affordable Housing", zip: "33128", phone: "(954) 922-3395", description: "Elderly Housing Development & Operations Corp - managing senior housing communities in S. Florida." },
  { name: "Legal Aid Service of Broward", category: "Legal Help", zip: "33301", phone: "(954) 765-8950", description: "Pro bono legal assistance for seniors facing housing, foreclosure, or estate issues." },
  { name: "Homestead Exemption Office", category: "Taxes", zip: "33128", phone: "(305) 375-4712", description: "Miami-Dade property tax savings. Ask about 'Save Our Homes' portability." },
];

export const SeniorDirectory: FC = () => {
  const [zip, setZip] = useState('');

  const filteredResources = RESOURCES.filter(r =>
    zip === '' || r.zip.includes(zip) || r.zip === "All S. Florida" || r.zip === "Florida Statewide"
  );

  return (
    <div className="space-y-8">
      {/* Tax Timeline / Education Section */}
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-blue-50">
        <div className="flex items-center space-x-4 mb-6">
          <span className="text-3xl">🗓️</span>
          <h2 className="text-3xl font-bold text-gray-800 tracking-tight">The Senior Homeowner's Calendar</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100">
            <p className="font-bold text-blue-900 text-lg">January 1st</p>
            <p className="text-sm text-blue-700 leading-relaxed mt-2">Assessment date. Florida sets your home's market value for the year.</p>
          </div>
          <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100">
            <p className="font-bold text-emerald-900 text-lg">March 1st</p>
            <p className="text-sm text-emerald-700 leading-relaxed mt-2">DEADLINE: Apply for Homestead and Senior Exemptions.</p>
          </div>
          <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-100">
            <p className="font-bold text-amber-900 text-lg">August</p>
            <p className="text-sm text-amber-700 leading-relaxed mt-2">TRIM Notices arrive. This is your window to contest assessments.</p>
          </div>
          <div className="bg-purple-50/50 p-5 rounded-2xl border border-purple-100">
            <p className="font-bold text-purple-900 text-lg">Nov - Mar</p>
            <p className="text-sm text-purple-700 leading-relaxed mt-2">Tax payment window. November payments get a 4% discount.</p>
          </div>
        </div>
      </div>

      {/* Directory Section */}
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Verified Support Network</h2>
            <p className="text-gray-600 senior-accessible-text mt-1">Non-profits and agencies that put families first.</p>
          </div>
          <div className="w-full md:w-auto relative">
            <input
              type="text"
              placeholder="Search by ZIP Code..."
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              className="w-full md:w-64 p-4 pl-12 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 shadow-inner"
            />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 text-xl">🔍</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredResources.map((res, i) => (
            <div key={i} className="p-6 border border-slate-100 rounded-3xl hover:border-blue-300 hover:shadow-lg transition-all group bg-white">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[10px] font-bold uppercase text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                  {res.category}
                </span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{res.zip === "All S. Florida" || res.zip === "Florida Statewide" ? "State" : res.zip}</span>
              </div>
              <h4 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-blue-700 transition-colors">{res.name}</h4>
              <p className="text-gray-600 mb-6 text-sm leading-relaxed">{res.description}</p>
              <a
                href={`tel:${res.phone}`}
                className="inline-flex items-center justify-center w-full bg-slate-50 text-blue-700 font-bold py-3 rounded-xl group-hover:bg-blue-700 group-hover:text-white transition-all border border-slate-200 group-hover:border-blue-700 shadow-sm"
              >
                <span className="mr-2">📞</span> {res.phone}
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
