
import { useState, useRef, useEffect, type FC, type RefObject } from 'react';
import { UserRole, UserData } from './types';
import { StephaniaAssistant } from './components/StephaniaAssistant';
import { NetProceedsCalculator } from './components/NetProceedsCalculator';
import { AgentDashboard } from './components/AgentDashboard';
import { SeniorDirectory } from './components/SeniorDirectory';
import { MarketTrendsChart } from './components/MarketTrendsChart';
import { CustomerPathfinder } from './components/CustomerPathfinder';
import { CustomerIntakeForm } from './components/SellerIntakeForm';
import { AgentAuth } from './components/AgentAuth';
import { isAuthenticated, getStoredAgent, clearAuth, AuthAgent } from './services/authService';

const App: FC = () => {
  const [role, setRole] = useState<UserRole>(UserRole.GUEST);
  const [userData, setUserData] = useState<UserData>({});
  const [agentUser, setAgentUser] = useState<AuthAgent | null>(null);
  const [agentAuthenticated, setAgentAuthenticated] = useState(false);


  const stephaniaRef = useRef<HTMLDivElement>(null);
  const calcRef = useRef<HTMLDivElement>(null);
  const directoryRef = useRef<HTMLDivElement>(null);
  const pathfinderRef = useRef<HTMLDivElement>(null);
  const contactRef = useRef<HTMLDivElement>(null);

  const scrollTo = (ref: RefObject<HTMLDivElement | null>) => {
    if (!ref.current) return;
    const offset = 140;
    const elementPosition = ref.current.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - offset;
    window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
  };

  // Check existing auth on mount
  useEffect(() => {
    if (isAuthenticated()) {
      const stored = getStoredAgent();
      if (stored) {
        setAgentUser(stored);
        setAgentAuthenticated(true);
      }
    }
  }, []);

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAuthSuccess = (agent: AuthAgent) => {
    setAgentUser(agent);
    setAgentAuthenticated(true);
  };

  const handleAgentLogout = () => {
    clearAuth();
    setAgentUser(null);
    setAgentAuthenticated(false);
    setRole(UserRole.GUEST);
  };

  const PortalNav = () => (
    <div className="sticky top-[73px] z-40 bg-[#fdfdfb]/95 backdrop-blur-md border-b-4 border-blue-50 py-4 shadow-sm">
      <div className="container mx-auto px-6 flex justify-center gap-12 overflow-x-auto no-scrollbar">
        <button onClick={() => scrollTo(pathfinderRef)} className="whitespace-nowrap px-6 py-2 text-sm font-black uppercase tracking-[0.2em] text-slate-400 hover:text-blue-700 transition-all">1. Planning Pathfinder</button>
        <button onClick={() => scrollTo(stephaniaRef)} className="whitespace-nowrap px-6 py-2 text-sm font-black uppercase tracking-[0.2em] text-slate-400 hover:text-blue-700 transition-all">2. Stephania Assistant</button>
        {role === UserRole.SELLER && <button onClick={() => scrollTo(calcRef)} className="whitespace-nowrap px-6 py-2 text-sm font-black uppercase tracking-[0.2em] text-slate-400 hover:text-blue-700 transition-all">3. Proceeds Hub</button>}
        <button onClick={() => scrollTo(directoryRef)} className="whitespace-nowrap px-6 py-2 text-sm font-black uppercase tracking-[0.2em] text-slate-400 hover:text-blue-700 transition-all">{role === UserRole.SELLER ? '4.' : '3.'} Local Support</button>
        <button onClick={() => scrollTo(contactRef)} className="whitespace-nowrap px-10 py-3 text-sm font-black uppercase tracking-widest text-white bg-blue-700 rounded-2xl hover:bg-blue-800 transition-all shadow-lg active:scale-95">Connect with Expert</button>
      </div>
    </div>
  );

  const LandingPage = () => (
    <div className="min-h-[85vh] flex flex-col items-center justify-center text-center p-8 bg-gradient-to-b from-blue-50/50 to-white">
      <div className="mb-16 animate-fade-in space-y-4">
        <div className="inline-flex items-center gap-3 px-6 py-2 bg-slate-100 text-slate-700 rounded-full text-sm font-black uppercase tracking-widest mb-4">
          <span>ℹ️</span> South Florida Transition Intelligence Hub
        </div>
        <h1 className="text-9xl font-black text-slate-900 tracking-tighter leading-none">Closr</h1>
        <p className="text-3xl text-slate-500 max-w-3xl mx-auto leading-relaxed font-medium">
          Dignified real estate for South Florida's seniors. <br /> No pressure. No games. Just heart.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-10 w-full max-w-7xl">
        <button
          onClick={() => handleRoleChange(UserRole.SELLER)}
          className="group bg-white p-16 rounded-[4rem] shadow-xl hover:shadow-2xl transition-all border-4 border-transparent hover:border-blue-400"
        >
          <div className="text-8xl mb-8">🏡</div>
          <h3 className="text-4xl font-black text-slate-900 mb-4">I want to Sell</h3>
          <p className="text-slate-400 text-xl font-medium senior-accessible-text">Guidance for downsizing, estate sales, or health-based moves.</p>
        </button>

        <button
          onClick={() => handleRoleChange(UserRole.BUYER)}
          className="group bg-white p-16 rounded-[4rem] shadow-xl hover:shadow-2xl transition-all border-4 border-transparent hover:border-purple-400"
        >
          <div className="text-8xl mb-8">🔑</div>
          <h3 className="text-4xl font-black text-slate-900 mb-4">I want to Buy</h3>
          <p className="text-slate-400 text-xl font-medium senior-accessible-text">Find active adult communities or accessible Florida homes.</p>
        </button>

        <button
          onClick={() => handleRoleChange(UserRole.AGENT)}
          className="group bg-white p-16 rounded-[4rem] shadow-xl hover:shadow-2xl transition-all border-4 border-transparent hover:border-emerald-400"
        >
          <div className="text-8xl mb-8">💼</div>
          <h3 className="text-4xl font-black text-slate-900 mb-4">I'm an Agent</h3>
          <p className="text-slate-400 text-xl font-medium senior-accessible-text">Ethical lead intelligence and compassionate automation.</p>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col selection:bg-blue-100 selection:text-blue-900">
      <header className="bg-white border-b-2 border-slate-50 sticky top-0 z-50 shadow-sm h-[73px] flex items-center">
        <div className="container mx-auto px-6 flex justify-between items-center">
          <div
            className="text-4xl font-black text-blue-700 cursor-pointer flex items-center gap-4"
            onClick={() => setRole(UserRole.GUEST)}
          >
            <span className="text-5xl">🤝</span>
            <span className="tracking-tighter">Closr</span>
          </div>

          <nav className="flex items-center gap-10">
            {role !== UserRole.GUEST && (
              <button
                onClick={() => {
                  if (role === UserRole.AGENT) handleAgentLogout();
                  else setRole(UserRole.GUEST);
                }}
                className="text-slate-400 hover:text-blue-700 font-black text-sm uppercase tracking-widest transition-colors"
              >
                {role === UserRole.AGENT ? 'Sign Out' : 'Exit Portal'}
              </button>
            )}
            <div className={`px-8 py-2.5 rounded-2xl font-black text-sm uppercase tracking-widest border-2 ${role === UserRole.SELLER ? 'bg-blue-50 text-blue-700 border-blue-200' :
              role === UserRole.BUYER ? 'bg-purple-50 text-purple-700 border-purple-200' :
                role === UserRole.AGENT ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-100'
              }`}>
              {role === UserRole.SELLER ? 'Seller Advocate Hub' : role === UserRole.BUYER ? 'Lifestyle Buyer Hub' : role === UserRole.AGENT ? 'Ethical Intelligence' : 'S. Florida Edition'}
            </div>
          </nav>
        </div>
      </header>

      {(role === UserRole.SELLER || role === UserRole.BUYER) && <PortalNav />}

      <main className="flex-grow container mx-auto px-6 py-20">
        {role === UserRole.GUEST && <LandingPage />}

        {(role === UserRole.SELLER || role === UserRole.BUYER) && (
          <div className="max-w-7xl mx-auto space-y-40">
            <section ref={pathfinderRef}>
              <CustomerPathfinder />
            </section>

            <section ref={stephaniaRef} className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
              <div>
                <h2 className="text-7xl font-black text-slate-900 mb-10 tracking-tight">Expert Advice with Stephania</h2>
                <p className="text-3xl text-slate-500 mb-12 senior-accessible-text leading-relaxed font-medium">
                  Stephania is our expert AI guide. She's trained specifically in Florida property laws, senior tax exemptions, and the emotional nuances of moving after many years.
                </p>
                <div className="space-y-8">
                  <div className="flex items-start gap-8 p-10 bg-white rounded-[3rem] shadow-sm border-2 border-slate-50 group hover:border-blue-200 transition-all">
                    <span className="text-6xl group-hover:scale-110 transition-transform">🕊️</span>
                    <div>
                      <p className="text-slate-900 font-black text-2xl mb-2">Zero-Pressure Guidance</p>
                      <p className="text-slate-400 text-lg senior-accessible-text">No sales pitches. Just the facts you need to make the right choice for your family.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-8 p-10 bg-white rounded-[3rem] shadow-sm border-2 border-slate-50 group hover:border-blue-200 transition-all">
                    <span className="text-6xl group-hover:scale-110 transition-transform">⚖️</span>
                    <div>
                      <p className="text-slate-900 font-black text-2xl mb-2">S. Florida Specialist</p>
                      <p className="text-slate-400 text-lg senior-accessible-text">Knows the deep details of Probate, SOH Portability, and local HOPA rules.</p>
                    </div>
                  </div>
                </div>
              </div>
              <StephaniaAssistant userData={{ ...userData, intent: role === UserRole.BUYER ? 'buy' : 'sell' }} />
            </section>

            {role === UserRole.SELLER && (
              <section ref={calcRef}>
                <NetProceedsCalculator />
              </section>
            )}

            <section ref={directoryRef}>
              <SeniorDirectory />
            </section>

            <section ref={contactRef}>
              <div className="text-center mb-16">
                <h2 className="text-7xl font-black text-slate-900 mb-6 tracking-tight">Finalize Your Private Roadmap</h2>
                <p className="text-2xl text-slate-500 senior-accessible-text max-w-2xl mx-auto">Complete your profile to receive a personalized transition plan. You decide when and if you want to connect with a person.</p>
              </div>
              <CustomerIntakeForm initialMode={role === UserRole.BUYER ? 'buy' : 'sell'} />
            </section>
          </div>
        )}

        {role === UserRole.AGENT && (
          <div className="max-w-7xl mx-auto">
            {agentAuthenticated && agentUser ? (
              <AgentDashboard agent={agentUser} onLogout={handleAgentLogout} />
            ) : (
              <AgentAuth onAuthSuccess={handleAuthSuccess} />
            )}
          </div>
        )}
      </main>

      <footer className="bg-slate-900 text-white py-40 border-t-8 border-blue-700 mt-40">
        <div className="container mx-auto px-6 flex flex-col items-center">
          <div className="text-6xl font-black mb-10 flex items-center gap-4">
            <span>🤝</span> Closr
          </div>
          <p className="text-slate-500 text-2xl max-w-2xl mx-auto text-center senior-accessible-text leading-relaxed mb-20">
            Advocating for South Florida's seniors through transparency, deep regional expertise, and compassionate AI.
          </p>
          <div className="flex flex-wrap justify-center gap-16 mb-20 opacity-40">
            <span className="font-black text-xs uppercase tracking-[0.4em]">Community-Driven Data</span>
            <span className="font-black text-xs uppercase tracking-[0.4em]">Privacy-First Analytics</span>
            <span className="font-black text-xs uppercase tracking-[0.4em]">Miami-Dade • Broward • Palm Beach</span>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-800">© 2025 Closr Technologies • A Human-Centered Real Estate Platform</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
