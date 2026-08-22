import React, { useState, useMemo } from 'react';
import { 
  Upload, Target, TrendingUp, Calendar, 
  CheckCircle2, AlertCircle, RefreshCcw, 
  Award, ArrowUpRight, BarChart3, Users, DollarSign,
  Calculator, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
  Cell, ReferenceLine, CartesianGrid, LabelList 
} from 'recharts';
import { parseExcelSales } from '../lib/excel-parser';
import { SaleRecord } from '../types';

function formatQ(amount: number) {
  return "Q" + amount.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function UnifiedWorkspace() {
  const [records, setRecords] = useState<SaleRecord[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [goalInput, setGoalInput] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('Certificado');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const [simulatingSellers, setSimulatingSellers] = useState<Record<string, boolean>>({});
  const [simulatedSales, setSimulatedSales] = useState<Record<string, string>>({});
  
  const [isSimulatingDays, setIsSimulatingDays] = useState<boolean>(false);
  const [simulatedDays, setSimulatedDays] = useState<string>('');

  const numGoal = parseFloat(goalInput.replace(/,/g, '')) || 0;

  // Date Logic
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const currentDay = today.getDate();
  
  let actualDaysLeft = daysInMonth - currentDay + 1; // Including today initially

  // If the current time is past 8:30 PM, the local is closed, 
  // so the current day is no longer considered available for selling.
  const currentHour = today.getHours();
  const currentMinute = today.getMinutes();
  
  if (currentHour > 20 || (currentHour === 20 && currentMinute >= 30)) {
    actualDaysLeft = Math.max(0, actualDaysLeft - 1);
  }

  const daysLeft = isSimulatingDays ? (parseInt(simulatedDays) || 0) : actualDaysLeft;

  const isStoreClosedToday = (currentHour > 20 || (currentHour === 20 && currentMinute >= 30));

  const handleToggleSimulation = (fullName: string, actualSales: number) => {
    setSimulatingSellers(prev => {
      const isSimulating = !prev[fullName];
      if (!isSimulating) {
        // Clear value if turning off
        setSimulatedSales(s => {
          const newS = { ...s };
          delete newS[fullName];
          return newS;
        });
      } else {
        // Initialize with actual sales
        setSimulatedSales(s => ({ ...s, [fullName]: actualSales.toString() }));
      }
      return { ...prev, [fullName]: isSimulating };
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    try {
      const data = await parseExcelSales(file);
      setRecords(data);
    } catch (err: any) {
      setError(err.message || 'Error al procesar el archivo');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setRecords(null);
    setError(null);
  };

  // Aggregation
  const sellerStats = useMemo(() => {
    if (!records) return [];
    
    const aggregated: Record<string, number> = {};
    records.forEach(r => {
      if (selectedStatus !== 'all' && r.estadoNombre !== selectedStatus) return;
      
      if (startDate) {
        const recordDate = new Date(r.fechaCreacion);
        if (!isNaN(recordDate.getTime())) {
          const y = recordDate.getFullYear();
          const m = String(recordDate.getMonth() + 1).padStart(2, '0');
          const d = String(recordDate.getDate()).padStart(2, '0');
          const recordDateStr = `${y}-${m}-${d}`;
          if (recordDateStr < startDate) return;
        }
      }

      if (endDate) {
        const recordDate = new Date(r.fechaCreacion);
        if (!isNaN(recordDate.getTime())) {
          const y = recordDate.getFullYear();
          const m = String(recordDate.getMonth() + 1).padStart(2, '0');
          const d = String(recordDate.getDate()).padStart(2, '0');
          const recordDateStr = `${y}-${m}-${d}`;
          if (recordDateStr > endDate) return;
        }
      }

      const name = r.usuarioVendedorNombre || 'Desconocido';
      aggregated[name] = (aggregated[name] || 0) + r.total;
    });

    return Object.entries(aggregated).map(([fullName, actualSales]) => {
      const isSimulating = simulatingSellers[fullName] || false;
      const rawSimulated = simulatedSales[fullName];
      
      const sales = isSimulating 
        ? (parseFloat((rawSimulated || '').toString().replace(/,/g, '')) || 0) 
        : actualSales;

      const diff = numGoal - sales;
      const isGoalReached = diff <= 0;
      const netSales = sales / 1.12;
      const netDiff = numGoal - netSales;
      const netProgress = numGoal > 0 ? Math.min((netSales / numGoal) * 100, 100) : 0;
      const commission = netSales * 0.02;
      const projectedCommission = (numGoal / 1.12) * 0.02;
      const dailyRequired = !isGoalReached && daysLeft > 0 ? diff / daysLeft : 0;
      const progress = numGoal > 0 ? Math.min((sales / numGoal) * 100, 100) : 0;
      
      const grossTargetForNetGoal = numGoal * 1.12;
      const diffForNetGoal = grossTargetForNetGoal - sales;
      const isNetGoalReached = diffForNetGoal <= 0;
      const dailyRequiredForNetGoal = !isNetGoalReached && daysLeft > 0 ? diffForNetGoal / daysLeft : 0;
      
      const shortName = fullName.split(' ')[0];

      return { 
        fullName,
        shortName, 
        actualSales,
        sales, 
        isSimulating,
        netSales,
        diff, 
        netDiff,
        isGoalReached, 
        commission, 
        projectedCommission,
        dailyRequired, 
        dailyRequiredForNetGoal,
        progress,
        netProgress,
        grossTargetForNetGoal,
        diffForNetGoal,
        isNetGoalReached
      };
    }).sort((a, b) => b.sales - a.sales);
  }, [records, numGoal, selectedStatus, startDate, endDate, daysLeft, simulatingSellers, simulatedSales]);

  const totalGlobalSales = useMemo(() => {
    return sellerStats.reduce((acc, curr) => acc + curr.actualSales, 0);
  }, [sellerStats]);

  const highestSeller = sellerStats.length > 0 ? sellerStats[0].shortName : null;

  if (!records) {
    return (
      <div className="flex-1 bg-gray-50 flex flex-col items-center justify-center p-4 font-sans text-gray-900">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-lg w-full bg-white shadow-xl shadow-gray-200/50 border border-gray-100 rounded-3xl p-10 text-center"
        >
          <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Upload className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold mb-3 tracking-tight text-gray-900">DataV Workspace</h1>
          <p className="text-gray-500 mb-8 text-base leading-relaxed">
            Sube tu base de datos de ventas (Excel) para combinar las estadísticas de tus vendedores con las metas de comisiones mensuales.
          </p>
          
          <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white py-4 px-8 rounded-2xl font-semibold transition-all shadow-lg shadow-blue-600/30 block mb-4 hover:shadow-blue-600/40 hover:-translate-y-0.5">
            {loading ? 'Procesando...' : 'Seleccionar Archivo Excel'}
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              className="hidden" 
              onChange={handleFileUpload}
              disabled={loading}
            />
          </label>
          
          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 bg-red-50 text-red-700 border border-red-100 rounded-2xl text-sm font-medium">
              {error}
            </motion.div>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gray-50 font-sans text-gray-900 flex flex-col">
      {/* Top Controls Bar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-indigo-500" />
                Meta Global por Vendedor
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">Q</span>
                <input
                  type="number"
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  className="pl-8 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all w-48"
                  placeholder="Ej. 350000"
                />
              </div>
            </div>

            <div className="hidden md:block w-px h-10 bg-gray-200"></div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-orange-500" />
                  {isSimulatingDays ? 'Simulador de Días' : 'Días Restantes'}
                </label>
                <button 
                  onClick={() => {
                    setIsSimulatingDays(!isSimulatingDays);
                    if (!isSimulatingDays) setSimulatedDays(daysLeft.toString());
                  }}
                  className={`p-1 rounded-md transition-colors ${isSimulatingDays ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-700'}`}
                  title={isSimulatingDays ? 'Cerrar simulador de días' : 'Simular días restantes'}
                >
                  {isSimulatingDays ? <X className="w-3.5 h-3.5" /> : <Calculator className="w-3.5 h-3.5" />}
                </button>
              </div>
              <div className="text-lg font-bold text-gray-900 flex items-baseline gap-1">
                {isSimulatingDays ? (
                  <input
                    type="number"
                    value={simulatedDays}
                    onChange={(e) => setSimulatedDays(e.target.value)}
                    className="w-16 bg-transparent text-lg font-extrabold text-indigo-600 leading-none outline-none border-b-2 border-indigo-200 focus:border-indigo-500 py-0.5"
                    min="0"
                  />
                ) : (
                  daysLeft
                )}
                {!isSimulatingDays && <span className="text-sm font-medium text-gray-500">de {daysInMonth}</span>}
                {isStoreClosedToday && !isSimulatingDays && (
                  <span className="ml-2 text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md flex items-center gap-1">
                    Cerrado por hoy
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
             <div className="flex items-center gap-2">
               <input 
                 type="date" 
                 value={startDate}
                 onChange={(e) => setStartDate(e.target.value)}
                 className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 hover:bg-gray-100 transition-colors text-gray-700"
                 title="Fecha Inicial"
               />
               <span className="text-gray-400 text-sm">-</span>
               <input 
                 type="date" 
                 value={endDate}
                 onChange={(e) => setEndDate(e.target.value)}
                 className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 hover:bg-gray-100 transition-colors text-gray-700"
                 title="Fecha Final"
               />
             </div>
             <select 
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 hover:bg-gray-100 transition-colors text-gray-700"
              >
                <option value="all">Todos los estados</option>
                <option value="Certificado">Certificado (Válido)</option>
                <option value="Anulado">Anulado (Inválido)</option>
                <option value="Pendiente aprobación precios">Pendiente aprobación precios (Inválido)</option>
                <option value="Emisión">Emisión (Inválido)</option>
              </select>
            <button 
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl text-sm font-medium text-gray-700 transition-colors shadow-sm"
            >
              <RefreshCcw className="w-4 h-4" />
              Cambiar Archivo
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-8">
        
        {/* Global Summary & Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 flex flex-col justify-center relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <TrendingUp className="w-32 h-32" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Ventas Totales del Equipo</h3>
              </div>
              <p className="text-5xl font-extrabold text-gray-900 tracking-tight">
                {formatQ(totalGlobalSales)}
              </p>
              <div className="mt-4 flex items-center gap-2 text-sm font-medium text-gray-500">
                <Users className="w-4 h-4" />
                {sellerStats.length} vendedores activos
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 lg:col-span-2">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-6 flex items-center gap-2">
              <Award className="w-4 h-4" />
              Rendimiento vs Meta Global
            </h3>
            <div className="h-64 w-full pointer-events-none">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  layout="vertical" 
                  data={sellerStats} 
                  margin={{ top: 10, right: 100, left: 10, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} stroke="#f3f4f6" />
                  <XAxis 
                    type="number" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: '#9ca3af' }} 
                    tickFormatter={(val) => `Q${(val / 1000)}k`} 
                  />
                  <YAxis 
                    dataKey="shortName" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 13, fill: '#1f2937', fontWeight: 600 }} 
                    width={100} 
                  />
                  {numGoal > 0 && (
                    <ReferenceLine x={numGoal} stroke="#9ca3af" strokeDasharray="4 4" label={{ position: 'top', value: 'Meta', fill: '#6b7280', fontSize: 12, fontWeight: 600 }} />
                  )}
                  <Bar dataKey="sales" barSize={12} radius={[50, 50, 50, 50]} activeBar={false}>
                    <LabelList 
                      dataKey="sales" 
                      position="right" 
                      formatter={(val: number) => formatQ(val)} 
                      fill="#4b5563" 
                      fontSize={12} 
                      fontWeight={600} 
                    />
                    {sellerStats.map((entry, index) => {
                      const colors = ['#34d399', '#fb923c', '#3b82f6', '#a78bfa', '#f472b6', '#38bdf8', '#facc15', '#fb7185'];
                      return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Sellers KPI Grid */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            Análisis de Comisiones por Asesor
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {sellerStats.map((seller, idx) => (
                <motion.div
                  key={seller.fullName}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`bg-white rounded-3xl shadow-sm hover:shadow-md transition-all border p-6 flex flex-col ${seller.isSimulating ? 'border-indigo-300 ring-4 ring-indigo-50' : 'border-gray-100'}`}
                >
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="font-bold text-lg text-gray-900 truncate max-w-[200px]" title={seller.fullName}>
                        {seller.fullName}
                      </h3>
                      <p className="text-sm font-medium text-gray-500 mt-0.5">
                        {seller.isGoalReached && numGoal > 0 ? '¡Meta superada!' : 'En progreso'}
                      </p>
                    </div>
                    {seller.shortName === highestSeller && seller.sales > 0 && (
                      <div className="p-2 bg-yellow-50 text-yellow-600 rounded-xl" title="Top Seller">
                        <Award className="w-5 h-5" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-5 flex-1">
                    {/* Sales vs Goal */}
                    <div>
                      <div className="flex justify-between items-end mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                              {seller.isSimulating ? 'Simulador Activo' : 'Ventas Actuales'}
                            </p>
                            <button 
                              onClick={() => handleToggleSimulation(seller.fullName, seller.actualSales)}
                              className={`p-1 rounded-md transition-colors ${seller.isSimulating ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-700'}`}
                              title={seller.isSimulating ? 'Cerrar simulador' : 'Simular proyección'}
                            >
                              {seller.isSimulating ? <X className="w-3.5 h-3.5" /> : <Calculator className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          
                          {seller.isSimulating ? (
                            <div className="mt-1 relative">
                              <span className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-500 font-bold">Q</span>
                              <input 
                                type="text"
                                className="w-32 bg-transparent text-2xl font-extrabold text-indigo-600 leading-none outline-none border-b-2 border-indigo-200 focus:border-indigo-500 pl-4 py-0.5"
                                value={simulatedSales[seller.fullName] || ''}
                                onChange={(e) => setSimulatedSales(s => ({ ...s, [seller.fullName]: e.target.value }))}
                                placeholder="0.00"
                              />
                            </div>
                          ) : (
                            <p className="text-2xl font-extrabold text-gray-900 leading-none mt-1">
                              {formatQ(seller.sales)}
                            </p>
                          )}

                          <p className="text-xs font-medium text-gray-500 mt-1.5 flex items-center gap-1" title="Venta real limpios de IVA">
                            Sin IVA: <span className="font-bold text-gray-700">{formatQ(seller.netSales)}</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-900">{seller.progress.toFixed(1)}% <span className="text-[10px] text-gray-500 font-medium ml-0.5 uppercase">bruto</span></p>
                          <p className="text-sm font-bold text-blue-600 mt-1">{seller.netProgress.toFixed(1)}% <span className="text-[10px] text-blue-400 font-medium ml-0.5 uppercase">sin IVA</span></p>
                        </div>
                      </div>
                      <div className="relative h-3 w-full bg-gray-100 rounded-full overflow-hidden flex items-center">
                        {/* Gross Progress (Background Bar) */}
                        <motion.div 
                          className={`absolute left-0 h-full rounded-full ${seller.isGoalReached ? 'bg-emerald-200' : 'bg-blue-200'}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${seller.progress}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                        />
                        {/* Net Progress (Inner Thin Line) */}
                        <motion.div 
                          className={`absolute left-0 h-1.5 rounded-full mx-0.5 ${seller.isGoalReached ? 'bg-emerald-500' : 'bg-blue-600'}`}
                          initial={{ width: 0 }}
                          animate={{ width: `calc(${seller.netProgress}% - 4px)` }}
                          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                        />
                      </div>
                    </div>

                    {/* Commission Stats */}
                    <div className="grid grid-cols-2 gap-3 bg-gray-50 p-4 rounded-2xl">
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          Comisión
                        </p>
                        <p className="text-lg font-bold text-emerald-600 mt-0.5">
                          {formatQ(seller.commission)}
                        </p>
                      </div>
                      <div className="pl-3 border-l border-gray-200">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                          Proyectado
                        </p>
                        <p className="text-lg font-bold text-gray-900 mt-0.5">
                          {formatQ(seller.projectedCommission)}
                        </p>
                      </div>
                    </div>

                    {/* Missing / Target Logic */}
                    <div className="pt-2">
                      {seller.isGoalReached && numGoal > 0 ? (
                        <div className="flex items-start gap-3 bg-emerald-50 text-emerald-700 p-3.5 rounded-2xl">
                          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium leading-tight">
                              Excede la meta por <br/><span className="font-bold text-base">{formatQ(Math.abs(seller.diff))}</span>
                            </p>
                            <p className="text-[11px] font-bold text-emerald-600 mt-1 flex items-center gap-1 uppercase tracking-wider">
                              Sin IVA: <span className="font-extrabold">{formatQ(Math.abs(seller.netDiff))}</span>
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-start gap-3 bg-amber-50 text-amber-800 p-3.5 rounded-2xl">
                            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
                            <div>
                              <p className="font-bold text-amber-900 leading-none mb-1">
                                {numGoal > 0 ? `Faltan ${formatQ(seller.diff)}` : 'Sin meta asignada'}
                              </p>
                              {numGoal > 0 && (
                                <>
                                  <p className="text-[11px] font-bold text-amber-700 mt-1.5 flex items-center gap-1 uppercase tracking-wider">
                                    Sin IVA: <span className="font-extrabold">{formatQ(seller.netDiff)}</span>
                                  </p>
                                  <p className="text-[10px] font-medium opacity-80 mt-0.5">para llegar a la meta</p>
                                </>
                              )}
                            </div>
                          </div>
                          
                          {daysLeft > 0 && numGoal > 0 && (
                            <div className="space-y-2 px-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                  <ArrowUpRight className="w-3.5 h-3.5" />
                                  Requisito Diario
                                </span>
                                <span className="font-bold text-gray-900">
                                  {formatQ(seller.dailyRequired)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between border-t border-gray-100 pt-2">
                                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider flex items-center gap-1">
                                  <ArrowUpRight className="w-3 h-3" />
                                  Req. Diario (Sin IVA)
                                </span>
                                <span className="font-bold text-indigo-700 text-sm">
                                  {formatQ(seller.dailyRequiredForNetGoal)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Meta equivalente libre de IVA */}
                    {numGoal > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="flex items-start gap-2 bg-indigo-50/50 p-3.5 rounded-xl border border-indigo-50/80">
                          <Target className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider mb-1 leading-tight">
                              Proyección Libre de IVA
                            </p>
                            <p className="text-xs text-indigo-700/90 leading-snug">
                              Para lograr <span className="font-bold text-indigo-900">{formatQ(numGoal)}</span> limpios de IVA, debes alcanzar <span className="font-bold text-indigo-900">{formatQ(seller.grossTargetForNetGoal)}</span> brutos.
                            </p>
                            
                            {!seller.isNetGoalReached ? (
                              <p className="text-[11px] font-bold text-indigo-600 mt-2 bg-indigo-100/50 inline-flex px-2 py-1 rounded-md items-center gap-1">
                                Faltan brutos: <span className="font-extrabold text-indigo-700">{formatQ(seller.diffForNetGoal)}</span>
                              </p>
                            ) : (
                              <p className="text-[11px] font-bold text-emerald-700 mt-2 bg-emerald-100/50 inline-flex px-2 py-1 rounded-md items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                ¡Meta libre de IVA alcanzada!
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}
