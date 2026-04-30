import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bot, Plus, Trash2, Power, PowerOff, Clock, Send as SendIcon,
  CheckCircle2, XCircle, AlertTriangle, Shield, Users, Megaphone,
  RefreshCw, Eye, EyeOff, Calendar, Zap, Globe, BarChart3,
  ChevronDown, Search
} from 'lucide-react';

/* ================================================================
   TYPES & MOCK DATA (PRESERVED)
================================================================ */
interface TelegramBot { id: string; name: string; username: string; token: string; isValid: boolean; isActive: boolean; createdAt: string; }
interface WhitelistedGroup { id: string; chatId: string; name: string; type: 'group' | 'channel'; isAllowed: boolean; }
interface Campaign { id: string; name: string; message: string; targetGroups: string[]; schedule: { startDate: string; startTime: string; interval: string; }; status: 'active' | 'paused' | 'completed'; sentCount: number; lastSent: string | null; }
interface LogEntry { id: string; timestamp: string; botName: string; targetGroup: string; status: 'success' | 'rate_limited' | 'banned' | 'error'; message: string; }

const MOCK_BOTS: TelegramBot[] = [
  { id: '1', name: 'PromoBot Alpha', username: '@promobot_alpha', token: '7841...QxPm', isValid: true, isActive: true, createdAt: '2026-04-01' },
  { id: '2', name: 'ShareBot Beta', username: '@sharebot_beta', token: '6523...HnLk', isValid: true, isActive: false, createdAt: '2026-04-05' },
];

const MOCK_GROUPS: WhitelistedGroup[] = [
  { id: '1', chatId: '-1001234567890', name: 'Crypto Traders ID', type: 'group', isAllowed: true },
  { id: '2', chatId: '-1009876543210', name: 'NFT Marketplace', type: 'channel', isAllowed: true },
  { id: '3', chatId: '-1005551234567', name: 'DeFi Indonesia', type: 'group', isAllowed: false },
  { id: '4', chatId: '@web3_updates', name: 'Web3 Updates', type: 'channel', isAllowed: true },
];

const MOCK_CAMPAIGNS: Campaign[] = [
  { id: '1', name: 'Launch Promo Q2', message: '{Hello|Hi|Hey} traders! Check out our new {feature|update|release} 🚀', targetGroups: ['1', '2'], schedule: { startDate: '2026-04-10', startTime: '09:00', interval: 'every_2h' }, status: 'active', sentCount: 47, lastSent: '2026-04-12T00:30:00Z' },
  { id: '2', name: 'Daily Tips', message: '📊 Daily market tip: Always {DYOR|check the charts|set stop-losses}!', targetGroups: ['1', '4'], schedule: { startDate: '2026-04-08', startTime: '08:00', interval: 'daily' }, status: 'paused', sentCount: 12, lastSent: '2026-04-11T08:00:00Z' },
];

const MOCK_LOGS: LogEntry[] = [
  { id: '1', timestamp: '2026-04-12T00:30:12Z', botName: 'PromoBot Alpha', targetGroup: 'Crypto Traders ID', status: 'success', message: 'Message delivered successfully' },
  { id: '2', timestamp: '2026-04-12T00:30:14Z', botName: 'PromoBot Alpha', targetGroup: 'NFT Marketplace', status: 'success', message: 'Message delivered successfully' },
  { id: '3', timestamp: '2026-04-11T22:30:09Z', botName: 'PromoBot Alpha', targetGroup: 'DeFi Indonesia', status: 'error', message: 'Group not in whitelist - skipped' },
  { id: '4', timestamp: '2026-04-11T20:30:05Z', botName: 'PromoBot Alpha', targetGroup: 'Crypto Traders ID', status: 'rate_limited', message: 'Too many requests - 429 (retry in 30s)' },
  { id: '5', timestamp: '2026-04-11T18:00:00Z', botName: 'ShareBot Beta', targetGroup: 'Web3 Updates', status: 'banned', message: 'Bot was kicked from the group' },
  { id: '6', timestamp: '2026-04-11T16:30:00Z', botName: 'PromoBot Alpha', targetGroup: 'Crypto Traders ID', status: 'success', message: 'Campaign "Launch Promo Q2" dispatched' },
];

/* ================================================================
   UI COMPONENTS (UPGRADED AESTHETICS)
================================================================ */

const StatusBadge = ({ status }: { status: string }) => {
  const config: Record<string, { bg: string; border: string; text: string; icon: React.ReactNode; glow: string }> = {
    success: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', glow: 'shadow-[0_0_10px_rgba(52,211,153,0.2)]', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    rate_limited: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', glow: 'shadow-[0_0_10px_rgba(251,191,36,0.2)]', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
    banned: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400', glow: 'shadow-[0_0_10px_rgba(248,113,113,0.2)]', icon: <XCircle className="w-3.5 h-3.5" /> },
    error: { bg: 'bg-orange-500/10', border: 'border-orange-500/20', text: 'text-orange-400', glow: 'shadow-[0_0_10px_rgba(251,146,60,0.2)]', icon: <XCircle className="w-3.5 h-3.5" /> },
    active: { bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', text: 'text-indigo-400', glow: 'shadow-[0_0_10px_rgba(99,102,241,0.2)]', icon: <Zap className="w-3.5 h-3.5" /> },
    paused: { bg: 'bg-gray-500/10', border: 'border-gray-500/20', text: 'text-gray-400', glow: '', icon: <Clock className="w-3.5 h-3.5" /> },
    completed: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', glow: 'shadow-[0_0_10px_rgba(96,165,250,0.2)]', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  };
  const c = config[status] || config.error;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider border backdrop-blur-md ${c.bg} ${c.border} ${c.text} ${c.glow}`}>
      {c.icon} {status.replace('_', ' ')}
    </span>
  );
};

const StatCard = ({ icon, label, value, gradient, delay }: { icon: React.ReactNode; label: string; value: string | number; gradient: string; delay: number }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.5, ease: "easeOut" }}
    className="relative group overflow-hidden bg-black/40 backdrop-blur-2xl border border-white/5 rounded-3xl p-6 transition-all duration-500 hover:border-white/10 hover:shadow-2xl hover:shadow-black/50"
  >
    {/* Subtle Glow Background */}
    <div className={`absolute -inset-20 opacity-0 group-hover:opacity-20 transition-opacity duration-700 blur-3xl rounded-full ${gradient}`} />
    
    <div className="relative flex items-center gap-5">
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border border-white/10 bg-gradient-to-br ${gradient} shadow-inner`}>
        {icon}
      </div>
      <div>
        <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-gray-500 tracking-tight">{value}</div>
        <div className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1 bg-white/5 inline-block px-2 py-0.5 rounded-md border border-white/5">{label}</div>
      </div>
    </div>
  </motion.div>
);

const GlassContainer = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={`bg-gradient-to-b from-white/[0.03] to-transparent backdrop-blur-xl border border-white/10 rounded-[2rem] shadow-2xl ${className}`}>
    {children}
  </div>
);

const InputGlass = ({ icon, ...props }: any) => (
  <div className="relative flex items-center">
    {icon && <div className="absolute left-4 text-gray-400">{icon}</div>}
    <input 
      {...props} 
      className={`w-full bg-black/40 border border-white/10 rounded-2xl ${icon ? 'pl-11' : 'px-4'} py-3.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all font-medium shadow-inner shadow-black/50`}
    />
  </div>
);

/* ================================================================
   MAIN COMPONENT
================================================================ */
export default function AutoPromotion() {
  const [activeTab, setActiveTab] = useState<'overview' | 'bots' | 'groups' | 'campaigns' | 'logs'>('overview');
  const [bots, setBots] = useState<TelegramBot[]>(MOCK_BOTS);
  const [groups, setGroups] = useState<WhitelistedGroup[]>(MOCK_GROUPS);
  const [campaigns, setCampaigns] = useState<Campaign[]>(MOCK_CAMPAIGNS);
  const [logs] = useState<LogEntry[]>(MOCK_LOGS);

  /* States */
  const [newToken, setNewToken] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [newGroupId, setNewGroupId] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupType, setNewGroupType] = useState<'group' | 'channel'>('group');
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [campaignMessage, setCampaignMessage] = useState('');
  const [campaignTargets, setCampaignTargets] = useState<string[]>([]);
  const [campaignDate, setCampaignDate] = useState('');
  const [campaignTime, setCampaignTime] = useState('');
  const [campaignInterval, setCampaignInterval] = useState('every_2h');
  const [logFilter, setLogFilter] = useState('all');

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'bots', label: 'Bot Engine', icon: <Bot className="w-4 h-4" /> },
    { id: 'groups', label: 'Access Control', icon: <Shield className="w-4 h-4" /> },
    { id: 'campaigns', label: 'Promoter', icon: <Megaphone className="w-4 h-4" /> },
    { id: 'logs', label: 'Live Logs', icon: <Clock className="w-4 h-4" /> },
  ] as const;

  /* Handlers */
  const handleValidateToken = async () => {
    if (!newToken.trim()) return;
    setIsValidating(true);
    await new Promise(r => setTimeout(r, 1500));
    setBots(prev => [...prev, { id: Date.now().toString(), name: `NetBot_${bots.length + 1}`, username: `@netbot_${Date.now().toString().slice(-4)}`, token: newToken.slice(0, 4) + '...' + newToken.slice(-4), isValid: true, isActive: false, createdAt: new Date().toISOString().split('T')[0] }]);
    setNewToken('');
    setIsValidating(false);
  };

  const handleAddGroup = () => {
    if (!newGroupId.trim() || !newGroupName.trim()) return;
    setGroups(prev => [...prev, { id: Date.now().toString(), chatId: newGroupId, name: newGroupName, type: newGroupType, isAllowed: true }]);
    setNewGroupId('');
    setNewGroupName('');
  };

  const handleCreateCampaign = () => {
    if (!campaignName.trim() || !campaignMessage.trim() || campaignTargets.length === 0) return;
    setCampaigns(prev => [...prev, { id: Date.now().toString(), name: campaignName, message: campaignMessage, targetGroups: campaignTargets, schedule: { startDate: campaignDate, startTime: campaignTime, interval: campaignInterval }, status: 'active', sentCount: 0, lastSent: null }]);
    setCampaignName('');
    setCampaignMessage('');
    setCampaignTargets([]);
    setShowCampaignForm(false);
  };

  const filteredLogs = logFilter === 'all' ? logs : logs.filter(l => l.status === logFilter);

  /* ============== RENDER VIEWS ============== */
  const renderOverview = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard icon={<Bot className="w-6 h-6 text-white" />} label="Active Agents" value={bots.filter(b => b.isActive).length} gradient="from-blue-600 to-cyan-500" delay={0.1} />
        <StatCard icon={<Users className="w-6 h-6 text-white" />} label="Secured Chats" value={groups.filter(g => g.isAllowed).length} gradient="from-emerald-600 to-teal-400" delay={0.2} />
        <StatCard icon={<Megaphone className="w-6 h-6 text-white" />} label="Live Promos" value={campaigns.filter(c => c.status === 'active').length} gradient="from-purple-600 to-indigo-500" delay={0.3} />
        <StatCard icon={<SendIcon className="w-6 h-6 text-white" />} label="Broadcasts" value={campaigns.reduce((sum, c) => sum + c.sentCount, 0)} gradient="from-orange-500 to-amber-400" delay={0.4} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Active Campaigns Glass */}
        <GlassContainer className="p-8">
          <h3 className="text-white font-black text-xl mb-6 flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-lg"><Megaphone className="w-5 h-5 text-indigo-400" /></div>
            Mission Control
          </h3>
          <div className="space-y-4">
            {campaigns.filter(c => c.status === 'active').map((c, i) => (
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} key={c.id} className="group flex items-center justify-between bg-black/40 hover:bg-white/5 border border-white/5 rounded-2xl p-5 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-white/10">
                    <Zap className="w-4 h-4 text-indigo-400 group-hover:animate-pulse" />
                  </div>
                  <div>
                    <div className="text-white font-bold tracking-wide">{c.name}</div>
                    <div className="text-xs text-gray-500 font-medium mt-1">{c.sentCount} operations executed</div>
                  </div>
                </div>
                <StatusBadge status={c.status} />
              </motion.div>
            ))}
            {campaigns.filter(c => c.status === 'active').length === 0 && <div className="text-gray-500 text-sm italic py-4">No active missions running...</div>}
          </div>
        </GlassContainer>

        {/* Live Logs Glass */}
        <GlassContainer className="p-8">
          <h3 className="text-white font-black text-xl mb-6 flex items-center gap-3">
            <div className="p-2 bg-rose-500/20 rounded-lg"><Clock className="w-5 h-5 text-rose-400" /></div>
            Signal Stream
          </h3>
          <div className="space-y-4 relative">
            <div className="absolute left-4 top-2 bottom-2 w-px bg-gradient-to-b from-white/10 via-white/5 to-transparent shadow-[0_0_10px_rgba(255,255,255,0.1)]" />
            {logs.slice(0, 4).map((log, i) => (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }} key={log.id} className="relative flex items-start gap-5 pl-10 group">
                {/* Node Dot */}
                <div className={`absolute left-[13px] top-1.5 w-2 h-2 rounded-full border-2 border-[#050505] shadow-[0_0_8px_currentColor] ${log.status === 'error' || log.status === 'banned' ? 'bg-red-400 text-red-400' : log.status === 'rate_limited' ? 'bg-amber-400 text-amber-400' : 'bg-emerald-400 text-emerald-400'}`} />
                
                <div className="flex-1 bg-black/40 border border-white/5 hover:border-white/10 rounded-2xl p-4 transition-all group-hover:translate-x-1">
                  <div className="flex justify-between items-center mb-2">
                    <StatusBadge status={log.status} />
                    <div className="text-[10px] text-gray-500 font-mono tracking-wider">{new Date(log.timestamp).toLocaleTimeString('id-ID')}</div>
                  </div>
                  <div className="text-gray-300 font-bold text-sm">{log.targetGroup}</div>
                  <div className="text-xs text-gray-400 mt-1 line-clamp-1">{log.message}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </GlassContainer>
      </div>
    </motion.div>
  );

  const renderBots = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
      <GlassContainer className="p-8">
        <h3 className="text-white font-black text-xl mb-6 flex items-center gap-3">
          <div className="p-2 bg-emerald-500/20 rounded-lg"><Bot className="w-5 h-5 text-emerald-400" /></div>
          Deploy New Agent
        </h3>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <InputGlass
              type={showToken ? 'text' : 'password'}
              value={newToken}
              onChange={(e: any) => setNewToken(e.target.value)}
              placeholder="Inject Bot Token Here..."
            />
            <button onClick={() => setShowToken(!showToken)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors">
              {showToken ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          <button
            onClick={handleValidateToken}
            disabled={isValidating || !newToken.trim()}
            className="px-8 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 disabled:grayscale text-white text-sm font-bold rounded-2xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] flex items-center justify-center gap-2"
          >
            {isValidating ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
            Initialize
          </button>
        </div>
      </GlassContainer>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {bots.map((bot, i) => (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} key={bot.id} className="relative group overflow-hidden bg-black/40 backdrop-blur-xl border border-white/5 rounded-[2rem] p-6 hover:border-white/10 transition-all">
            {bot.isActive && <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />}
            
            <div className="relative flex items-start justify-between">
              <div className="flex items-center gap-5">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border ${bot.isActive ? 'bg-emerald-500/20 border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.3)]' : 'bg-gray-800/50 border-white/5'}`}>
                  <Bot className={`w-8 h-8 ${bot.isActive ? 'text-emerald-400' : 'text-gray-500'}`} />
                </div>
                <div>
                  <div className="text-white font-black text-xl tracking-wide flex items-center gap-2">
                    {bot.name}
                    {bot.isActive && <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399] animate-pulse" />}
                  </div>
                  <div className="text-sm text-indigo-400 font-mono mt-1">{bot.username}</div>
                  <div className="text-xs text-gray-500 font-mono mt-1 border border-white/5 bg-white/5 inline-block px-2 py-0.5 rounded-lg text-nowrap max-w-[150px] overflow-hidden text-ellipsis">{bot.token}</div>
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setBots(prev => prev.map(b => b.id === bot.id ? { ...b, isActive: !b.isActive } : b))}
                  className={`p-3 rounded-xl transition-all backdrop-blur-md border ${bot.isActive ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20' : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}`}
                >
                  {bot.isActive ? <Power className="w-5 h-5" /> : <PowerOff className="w-5 h-5" />}
                </button>
                <button onClick={() => setBots(prev => prev.filter(b => b.id !== bot.id))} className="p-3 rounded-xl bg-red-500/5 border border-red-500/10 text-red-400/70 hover:bg-red-500/20 hover:text-red-400 transition-all">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );

  const renderGroups = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
      <GlassContainer className="p-8">
        <h3 className="text-white font-black text-xl mb-6 flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg"><Shield className="w-5 h-5 text-blue-400" /></div>
          Whitelist New Sector
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-4"><InputGlass value={newGroupId} onChange={(e:any) => setNewGroupId(e.target.value)} placeholder="Chat ID / Alias..." /></div>
          <div className="md:col-span-4"><InputGlass value={newGroupName} onChange={(e:any) => setNewGroupName(e.target.value)} placeholder="Sector Name..." /></div>
          <div className="md:col-span-2">
            <select value={newGroupType} onChange={e => setNewGroupType(e.target.value as 'group' | 'channel')} className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none font-bold">
              <option value="group">Group</option>
              <option value="channel">Channel</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <button onClick={handleAddGroup} className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-white font-bold rounded-2xl shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] transition-all">Add Sector</button>
          </div>
        </div>
      </GlassContainer>

      <div className="bg-black/20 backdrop-blur-xl border border-white/5 rounded-[2rem] p-6 lg:p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groups.map((group, i) => (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }} key={group.id} className="bg-black/40 border border-white/5 hover:border-white/10 rounded-2xl p-5 flex items-center justify-between transition-all group hover:bg-white/[0.02]">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border border-white/5 ${group.type === 'channel' ? 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20 shadow-inner' : 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 shadow-inner'}`}>
                  {group.type === 'channel' ? <Globe className="w-5 h-5 text-blue-400 shadow-[0_0_10px_currentColor]" /> : <Users className="w-5 h-5 text-purple-400 shadow-[0_0_10px_currentColor]" />}
                </div>
                <div>
                  <div className="text-white font-bold tracking-wide">{group.name}</div>
                  <div className="text-xs text-gray-500 font-mono mt-0.5">{group.chatId}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setGroups(prev => prev.map(g => g.id === group.id ? { ...g, isAllowed: !g.isAllowed } : g))}
                  className={`relative w-12 h-7 rounded-full transition-colors duration-300 ease-in-out border ${group.isAllowed ? 'bg-indigo-500 border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'bg-gray-800 border-gray-700 shadow-inner'}`}
                >
                  <motion.div layout className={`absolute top-[3px] w-5 h-5 rounded-full bg-white shadow-md ${group.isAllowed ? 'right-1' : 'left-1'}`} />
                </button>
                <button onClick={() => setGroups(prev => prev.filter(g => g.id !== group.id))} className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );

  const renderCampaigns = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
      <div className="flex justify-end">
        <button onClick={() => setShowCampaignForm(!showCampaignForm)} className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white font-bold rounded-2xl flex items-center gap-2 shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:shadow-[0_0_30px_rgba(168,85,247,0.5)] transition-all">
          {showCampaignForm ? <XCircle className="w-5 h-5" /> : <Plus className="w-5 h-5" />} New Sequence
        </button>
      </div>

      <AnimatePresence>
        {showCampaignForm && (
          <motion.div initial={{ opacity: 0, y: -20, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: -20, height: 0 }} className="overflow-hidden">
            <GlassContainer className="p-8 relative overflow-hidden ring-1 ring-purple-500/30">
              <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-500/10 blur-[100px] rounded-full pointer-events-none" />
              
              <h3 className="text-xl font-black text-white mb-6">Create Broadcast Sequence</h3>
              
              <div className="space-y-6 relative z-10">
                <InputGlass value={campaignName} onChange={(e:any) => setCampaignName(e.target.value)} placeholder="Sequence Protocol Name" />
                
                <div>
                  <textarea value={campaignMessage} onChange={e => setCampaignMessage(e.target.value)} placeholder="Message template... Use {VariantA|VariantB} for SPINTAX bypass." rows={4} className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none font-mono shadow-inner leading-relaxed" />
                </div>
                
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                  <label className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-3 block">Target Vectors</label>
                  <div className="flex flex-wrap gap-3">
                    {groups.filter(g => g.isAllowed).map(g => (
                      <button
                        key={g.id}
                        onClick={() => setCampaignTargets(prev => prev.includes(g.id) ? prev.filter(x => x !== g.id) : [...prev, g.id])}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${campaignTargets.includes(g.id) ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.2)] hover:bg-purple-500/30' : 'bg-black/50 border-white/10 text-gray-500 hover:text-white hover:border-white/20'}`}
                      >
                        {g.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <label className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-2 block">Initialization Date</label>
                    <input type="date" value={campaignDate} onChange={e => setCampaignDate(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 font-bold" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-2 block">Zero Hour</label>
                    <input type="time" value={campaignTime} onChange={e => setCampaignTime(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 font-bold" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-2 block">Frequency Interval</label>
                    <div className="relative">
                      <select value={campaignInterval} onChange={e => setCampaignInterval(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 font-bold appearance-none">
                        <option value="every_30m">Every 30 Minutes</option>
                        <option value="every_1h">Every 1 Hour</option>
                        <option value="every_2h">Every 2 Hours</option>
                        <option value="every_6h">Every 6 Hours</option>
                        <option value="daily">Daily Batch</option>
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <button onClick={handleCreateCampaign} className="w-full py-4 mt-2 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white font-black text-lg rounded-2xl transition-all flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(139,92,246,0.4)] hover:shadow-[0_0_30px_rgba(139,92,246,0.6)]">
                  <Zap className="w-6 h-6" /> ARM SEQUENCE
                </button>
              </div>
            </GlassContainer>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-6">
        {campaigns.map((c, i) => (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} key={c.id} className="group relative bg-black/40 backdrop-blur-xl border border-white/5 rounded-[2rem] p-6 lg:p-8 hover:border-white/10 transition-all overflow-hidden">
            {c.status === 'active' && <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[80px] rounded-full pointer-events-none" />}
            
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center shadow-inner">
                    <Megaphone className={`w-6 h-6 ${c.status === 'active' ? 'text-indigo-400 animate-pulse' : 'text-gray-500'}`} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white tracking-wide">{c.name}</h3>
                    <div className="flex items-center gap-3 mt-1 text-xs font-bold text-gray-500 uppercase tracking-widest">
                      <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-indigo-400" /> {c.schedule.interval.replace('_', ' ')}</span>
                      <span className="w-1 h-1 rounded-full bg-white/20" />
                      <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-teal-400" /> {c.targetGroups.length} Nodes</span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-black/50 border border-white/5 rounded-2xl p-4 font-mono text-[13px] text-gray-400 leading-relaxed shadow-inner max-w-3xl">
                  {c.message}
                </div>
              </div>

              <div className="flex lg:flex-col items-center lg:items-end justify-between gap-4 border-t lg:border-t-0 lg:border-l border-white/5 pt-5 lg:pt-0 lg:pl-8">
                <StatusBadge status={c.status} />
                
                <div className="text-right">
                  <div className="text-3xl font-black text-white px-2">{c.sentCount}</div>
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Payloads Sent</div>
                </div>

                <button
                  onClick={() => setCampaigns(prev => prev.map(camp => camp.id === c.id ? { ...camp, status: camp.status === 'active' ? 'paused' : 'active' } : camp))}
                  className={`mt-2 w-full py-2.5 px-6 rounded-xl font-bold text-sm transition-all shadow-lg ${c.status === 'active' ? 'bg-black text-gray-400 border border-white/10 hover:text-white hover:bg-white/5' : 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white border border-transparent shadow-indigo-500/20 hover:shadow-indigo-500/40'}`}
                >
                  {c.status === 'active' ? 'HALT SEQUENCE' : 'RESUME SEQUENCE'}
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );

  const renderLogs = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6 h-full flex flex-col">
      <div className="flex gap-2 p-1.5 bg-black/40 backdrop-blur-xl border border-white/5 rounded-2xl w-max shadow-inner shadow-black/50">
        {['all', 'success', 'rate_limited', 'banned', 'error'].map(f => (
          <button
            key={f}
            onClick={() => setLogFilter(f)}
            className={`relative px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all z-10 ${logFilter === f ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            {logFilter === f && <motion.div layoutId="logFilter" className="absolute inset-0 bg-white/10 border border-white/10 rounded-xl -z-10 shadow-lg shadow-white/5" />}
            {f === 'all' ? 'All Signals' : f.replace('_', ' ')}
          </button>
        ))}
      </div>

      <GlassContainer className="flex-1 min-h-[400px] flex flex-col overflow-hidden">
        <div className="overflow-x-auto flex-1 p-2">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-6 py-5 text-xs font-black text-gray-600 uppercase tracking-widest bg-black/20 rounded-tl-xl">Timestamp (UTC)</th>
                <th className="px-6 py-5 text-xs font-black text-gray-600 uppercase tracking-widest bg-black/20">Agent Origin</th>
                <th className="px-6 py-5 text-xs font-black text-gray-600 uppercase tracking-widest bg-black/20">Target Node</th>
                <th className="px-6 py-5 text-xs font-black text-gray-600 uppercase tracking-widest bg-black/20">Status</th>
                <th className="px-6 py-5 text-xs font-black text-gray-600 uppercase tracking-widest bg-black/20 rounded-tr-xl">Diagnostic Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <AnimatePresence>
                {filteredLogs.map((log, i) => (
                  <motion.tr 
                    initial={{ opacity: 0, x: -10 }} 
                    animate={{ opacity: 1, x: 0 }} 
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: i * 0.05 }} 
                    key={log.id} 
                    className="hover:bg-white/[0.03] transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-5 text-gray-500 font-mono text-[11px] whitespace-nowrap">{new Date(log.timestamp).toISOString().replace('T', ' ').slice(0, -5)}</td>
                    <td className="px-6 py-5 text-gray-300 font-bold whitespace-nowrap flex items-center gap-2"><Bot className="w-4 h-4 text-indigo-400 opacity-50 group-hover:opacity-100 transition-opacity" /> {log.botName}</td>
                    <td className="px-6 py-5 text-gray-400 whitespace-nowrap">{log.targetGroup}</td>
                    <td className="px-6 py-5"><StatusBadge status={log.status} /></td>
                    <td className="px-6 py-5 text-gray-500 text-xs truncate max-w-sm group-hover:text-gray-300 transition-colors">{log.message}</td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          {filteredLogs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-gray-600 space-y-3">
              <Search className="w-10 h-10 opacity-20" />
              <div className="font-bold text-sm tracking-widest uppercase">No signals found</div>
            </div>
          )}
        </div>
      </GlassContainer>
    </motion.div>
  );

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-[#000000] selection:bg-indigo-500/30">
      {/* Background Graphic */}
      <div className="fixed inset-0 z-0 pointer-events-none flex justify-center items-center overflow-hidden opacity-40 mix-blend-screen">
        <div className="w-[800px] h-[800px] bg-gradient-radial from-indigo-500/10 via-purple-500/5 to-transparent blur-[120px] rounded-full scale-150 transform-gpu" />
      </div>

      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-end justify-between px-8 lg:px-12 py-8 shrink-0">
          <div>
            <h1 className="text-3xl lg:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500 tracking-tight flex items-center gap-4">
              <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.05)] backdrop-blur-xl">
                <Megaphone className="w-6 h-6 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
              </div>
              Auto Promotion
            </h1>
            <p className="text-sm text-gray-500 mt-2 font-bold uppercase tracking-widest">Telegram Bot Auto-Share & Scheduler Management</p>
          </div>
        </div>

        {/* Floating Tab Navigation */}
        <div className="px-8 lg:px-12 pb-6 shrink-0 z-20">
          <div className="flex items-center gap-2 p-1.5 bg-white/[0.02] backdrop-blur-2xl border border-white/10 rounded-2xl w-max shadow-2xl">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2.5 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all z-10 ${activeTab === tab.id ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
              >
                {activeTab === tab.id && <motion.div layoutId="mainTabIndicator" className="absolute inset-0 bg-white/10 border border-white/10 rounded-xl -z-10 shadow-lg shadow-white/5" />}
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-8 lg:px-12 pb-12 custom-scrollbar relative z-10">
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && <motion.div key="overview"><>{renderOverview()}</></motion.div>}
            {activeTab === 'bots' && <motion.div key="bots"><>{renderBots()}</></motion.div>}
            {activeTab === 'groups' && <motion.div key="groups"><>{renderGroups()}</></motion.div>}
            {activeTab === 'campaigns' && <motion.div key="campaigns"><>{renderCampaigns()}</></motion.div>}
            {activeTab === 'logs' && <motion.div key="logs"><>{renderLogs()}</></motion.div>}
          </AnimatePresence>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
}
