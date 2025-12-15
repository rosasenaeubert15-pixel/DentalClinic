import React, { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { db } from '../../../firebase.config';
import {
  Users,
  Calendar,
  DollarSign,
  TrendingUp,
  Clock,
  AlertCircle,
  Stethoscope,
  ArrowUp,
  ArrowDown,
  Activity,
  CheckCircle,
  XCircle,
  Info,
  PiggyBank,
  CreditCard
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

export default function Dashboard() {
  // --- Compute total earnings and unpaid balances ---
  const [billingSummary, setBillingSummary] = useState({
    totalEarnings: 0,
    totalUnpaid: 0,
    monthEarnings: 0,
    lastMonthEarnings: 0,
    monthUnpaid: 0,
    lastMonthUnpaid: 0
  });

  useEffect(() => {
    const treatedQuery = query(
      collection(db, 'appointments'),
      where('status', '==', 'treated')
    );
    const unsubTreated = onSnapshot(treatedQuery, (snapshot) => {
      const treated = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const onlineTreatedQuery = query(
        collection(db, 'onlineRequests'),
        where('status', '==', 'treated')
      );
      onSnapshot(onlineTreatedQuery, (onlineSnap) => {
        const onlineTreated = onlineSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const allBillings = [...treated, ...onlineTreated];
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        let totalEarnings = 0, totalUnpaid = 0, monthEarnings = 0, lastMonthEarnings = 0, monthUnpaid = 0, lastMonthUnpaid = 0;
        allBillings.forEach(b => {
          const paid = b.amountPaid || 0;
          const balance = (b.price || b.totalAmount || 0) - paid;
          const status = balance <= 0 ? 'paid' : (paid > 0 ? 'partial' : 'unpaid');
          totalEarnings += paid;
          if (status === 'unpaid' || status === 'partial') totalUnpaid += balance;
          
          if (b.date) {
            const bDate = new Date(b.date);
            if (bDate.getMonth() === currentMonth && bDate.getFullYear() === currentYear) {
              monthEarnings += paid;
              if (status === 'unpaid' || status === 'partial') monthUnpaid += balance;
            } else if (bDate.getMonth() === currentMonth - 1 && bDate.getFullYear() === currentYear || (currentMonth === 0 && bDate.getMonth() === 11 && bDate.getFullYear() === currentYear - 1)) {
              lastMonthEarnings += paid;
              if (status === 'unpaid' || status === 'partial') lastMonthUnpaid += balance;
            }
          }
        });
        setBillingSummary({ totalEarnings, totalUnpaid, monthEarnings, lastMonthEarnings, monthUnpaid, lastMonthUnpaid });
      });
    });
    return () => {
      unsubTreated();
    };
  }, []);

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalAppointments: 0,
    todayAppointments: 0,
    pendingAppointments: 0,
    approvedAppointments: 0,
    completedAppointments: 0,
    cancelledAppointments: 0,
    totalRevenue: 0,
    todayRevenue: 0,
    monthRevenue: 0,
    totalPatients: 0,
    newPatientsThisMonth: 0,
    totalDentists: 0,
    activeDentists: 0,
    revenueByMonth: [],
    appointmentsByDay: [],
    appointmentsByStatus: [],
    topDentists: [],
    topTreatments: [],
    patientGenderStats: [],
    patientAgeStats: []
  });
  const [selectedYear, setSelectedYear] = useState(2024);

  useEffect(() => {
    const unsubscribers = [];
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Appointments
    const appointmentsQuery = query(collection(db, 'appointments'));
    const unsubAppt = onSnapshot(appointmentsQuery, (snapshot) => {
      const appts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      
      const onlineQuery = query(collection(db, 'onlineRequests'));
      const unsubOnline = onSnapshot(onlineQuery, (onlineSnap) => {
        const onlineAppts = onlineSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const allAppointments = [...appts, ...onlineAppts];
        
        const todayAppts = allAppointments.filter(a => a.date === today);
        const pending = allAppointments.filter(a => (a.status || '').toLowerCase() === 'pending');
        const approved = allAppointments.filter(a => (a.status || '').toLowerCase() === 'approved');
        const completed = allAppointments.filter(a => (a.status || '').toLowerCase() === 'treated' || (a.status || '').toLowerCase() === 'completed');
        const cancelled = allAppointments.filter(a => (a.status || '').toLowerCase() === 'cancelled');
        
        const upcoming = allAppointments
          .filter(a => {
            if (!a.date) return false;
            const apptDate = new Date(a.date);
            const daysDiff = Math.ceil((apptDate - now) / (1000 * 60 * 60 * 24));
            return daysDiff >= 0 && daysDiff <= 3 && (a.status || '').toLowerCase() === 'approved';
          })
          .sort((a, b) => new Date(a.date) - new Date(b.date))
          .slice(0, 5);
        
        const recent = allAppointments
          .sort((a, b) => {
            const dateA = a.createdAt?.toDate?.() || new Date(a.date);
            const dateB = b.createdAt?.toDate?.() || new Date(b.date);
            return dateB - dateA;
          })
          .slice(0, 10);
        
        const appointmentsByDay = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
          
          const dayAppointments = allAppointments.filter(a => a.date === dateStr);
          appointmentsByDay.push({
            day: dayName,
            date: dateStr,
            count: dayAppointments.length,
            pending: dayAppointments.filter(a => (a.status || '').toLowerCase() === 'pending').length,
            approved: dayAppointments.filter(a => (a.status || '').toLowerCase() === 'approved').length,
            completed: dayAppointments.filter(a => (a.status || '').toLowerCase() === 'treated').length
          });
        }
        
        const appointmentsByStatus = [
          { name: 'Pending', value: pending.length, color: '#f59e0b' },
          { name: 'Approved', value: approved.length, color: '#3b82f6' },
          { name: 'Completed', value: completed.length, color: '#10b981' },
          { name: 'Cancelled', value: cancelled.length, color: '#ef4444' }
        ];
        
        const treatmentCounts = {};
        allAppointments.forEach(a => {
          const treatment = a.treatmentOption || a.treatment || a.service || a.procedure || null;
          if (treatment) {
            treatmentCounts[treatment] = (treatmentCounts[treatment] || 0) + 1;
          }
        });
        const sortedTreatments = Object.entries(treatmentCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, value], i) => ({
            name,
            value,
            color: ["#6366f1", "#f59e42", "#10b981", "#f43f5e", "#3b82f6"][i % 5]
          }));

        setStats(prev => ({
          ...prev,
          totalAppointments: allAppointments.length,
          todayAppointments: todayAppts.length,
          pendingAppointments: pending.length,
          approvedAppointments: approved.length,
          completedAppointments: completed.length,
          cancelledAppointments: cancelled.length,
          appointmentsByDay,
          appointmentsByStatus,
          topTreatments: sortedTreatments
        }));
      });
      
      unsubscribers.push(unsubOnline);
    });
    unsubscribers.push(unsubAppt);

    // Billing
    const treatedQuery = query(
      collection(db, 'appointments'),
      where('status', '==', 'treated')
    );
    const unsubTreated = onSnapshot(treatedQuery, (snapshot) => {
      const treated = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      
      const onlineTreatedQuery = query(
        collection(db, 'onlineRequests'),
        where('status', '==', 'treated')
      );
      
      onSnapshot(onlineTreatedQuery, (onlineSnap) => {
        const onlineTreated = onlineSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const allBillings = [...treated, ...onlineTreated];
        
        let totalRev = 0;
        let todayRev = 0;
        let monthRev = 0;
        
        allBillings.forEach(b => {
          const paid = b.amountPaid || 0;
          totalRev += paid;
          
          if (b.date === today) {
            todayRev += paid;
          }
          
          if (b.date) {
            const bDate = new Date(b.date);
            if (bDate.getMonth() === currentMonth && bDate.getFullYear() === currentYear) {
              monthRev += paid;
            }
          }
        });
        
        const revenueByMonth = [];
        for (let i = 11; i >= 0; i--) {
          const date = new Date();
          date.setMonth(date.getMonth() - i);
          const monthName = date.toLocaleDateString('en-US', { month: 'short' });
          const year = date.getFullYear();
          const month = date.getMonth() + 1;
          
          const monthRevenue = allBillings
            .filter(b => {
              if (!b.date) return false;
              const bDate = new Date(b.date);
              return bDate.getMonth() + 1 === month && bDate.getFullYear() === year;
            })
            .reduce((sum, b) => sum + (b.amountPaid || 0), 0);
          
          revenueByMonth.push({
            month: monthName,
            revenue: monthRevenue,
            appointments: allBillings.filter(b => {
              if (!b.date) return false;
              const bDate = new Date(b.date);
              return bDate.getMonth() + 1 === month && bDate.getFullYear() === year;
            }).length
          });
        }
        
        setStats(prev => ({
          ...prev,
          totalRevenue: totalRev,
          todayRevenue: todayRev,
          monthRevenue: monthRev,
          revenueByMonth
        }));
      });
    });
    unsubscribers.push(unsubTreated);

    // Users
    async function loadUsers() {
      try {
        const [patientsSnap, dentistsSnap] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'dentists'))
        ]);

        const patients = patientsSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(u => (u.role || '').toLowerCase() === 'patient');

        const genderCounts = { Male: 0, Female: 0, Other: 0 };
        patients.forEach(p => {
          const g = (p.gender || '').toLowerCase();
          if (g === 'male') genderCounts.Male++;
          else if (g === 'female') genderCounts.Female++;
          else genderCounts.Other++;
        });
        const patientGenderStats = [
          { name: 'Male', value: genderCounts.Male, color: '#3b82f6' },
          { name: 'Female', value: genderCounts.Female, color: '#f43f5e' },
          { name: 'Other', value: genderCounts.Other, color: '#f59e42' }
        ];

        const ageGroups = [
          { name: '0-12', min: 0, max: 12, value: 0, color: '#a3e635' },
          { name: '13-19', min: 13, max: 19, value: 0, color: '#fbbf24' },
          { name: '20-35', min: 20, max: 35, value: 0, color: '#60a5fa' },
          { name: '36-59', min: 36, max: 59, value: 0, color: '#f472b6' },
          { name: '60+', min: 60, max: 200, value: 0, color: '#a78bfa' }
        ];
        const nowYear = new Date().getFullYear();
        patients.forEach(p => {
          let age = null;
          if (p.birthdate) {
            const birthYear = new Date(p.birthdate).getFullYear();
            age = nowYear - birthYear;
          } else if (p.age) {
            age = Number(p.age);
          }
          if (typeof age === 'number' && !isNaN(age)) {
            for (const group of ageGroups) {
              if (age >= group.min && age <= group.max) {
                group.value++;
                break;
              }
            }
          }
        });
        const patientAgeStats = ageGroups;

        const newPatientsThisMonth = patients.filter(p => {
          if (!p.createdAt) return false;
          const createdDate = p.createdAt.toDate?.() || new Date(p.createdAt);
          return createdDate.getMonth() === currentMonth && createdDate.getFullYear() === currentYear;
        }).length;

        const dentistsList = dentistsSnap.docs.map(d => ({ 
          id: d.id, 
          ...d.data() 
        }));

        const appointmentsSnap = await getDocs(collection(db, 'appointments'));
        const onlineSnap = await getDocs(collection(db, 'onlineRequests'));

        const allAppts = [
          ...appointmentsSnap.docs.map(d => d.data()),
          ...onlineSnap.docs.map(d => d.data())
        ];

        const dentistCounts = {};
        const dentistRevenue = {};

        allAppts.forEach(apt => {
          const dentistId = apt.providerId || apt.preferredDentist;
          if (dentistId) {
            dentistCounts[dentistId] = (dentistCounts[dentistId] || 0) + 1;
            if (apt.amountPaid) {
              dentistRevenue[dentistId] = (dentistRevenue[dentistId] || 0) + apt.amountPaid;
            }
          }
        });

        const topDentists = dentistsList
          .map(d => ({
            ...d,
            appointmentCount: dentistCounts[d.id] || 0,
            revenue: dentistRevenue[d.id] || 0
          }))
          .sort((a, b) => b.appointmentCount - a.appointmentCount)
          .slice(0, 5);

        const activeDentists = dentistsList.filter(d => 
          (dentistCounts[d.id] || 0) > 0
        ).length;

        setStats(prev => ({
          ...prev,
          totalPatients: patients.length,
          newPatientsThisMonth,
          totalDentists: dentistsSnap.size,
          activeDentists,
          topDentists,
          patientGenderStats,
          patientAgeStats
        }));

        setLoading(false);
      } catch (error) {
        console.error('Error loading users:', error);
        setLoading(false);
      }
    }
    
    loadUsers();

    return () => {
      unsubscribers.forEach(unsub => unsub && unsub());
    };
  }, [selectedYear]);

  const calculateGrowth = (current, previous) => {
    if (previous === 0) return { value: 0, isPositive: true };
    const growth = ((current - previous) / previous) * 100;
    return { value: Math.abs(Math.round(growth)), isPositive: growth >= 0 };
  };

  const appointmentGrowth = calculateGrowth(
    stats.appointmentsByDay[stats.appointmentsByDay.length - 1]?.count || 0,
    stats.appointmentsByDay[0]?.count || 0
  );

  const getStatusColor = (status) => {
    const statusLower = (status || '').toLowerCase();
    if (statusLower === 'pending') return 'text-yellow-600 bg-yellow-50';
    if (statusLower === 'approved') return 'text-blue-600 bg-blue-50';
    if (statusLower === 'treated' || statusLower === 'completed') return 'text-green-600 bg-green-50';
    if (statusLower === 'cancelled') return 'text-red-600 bg-red-50';
    return 'text-gray-600 bg-gray-50';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <div className="mb-6">
          <p className="text-sm text-gray-600 mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Top Stats Cards - 3 Cards in Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Patients Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="text-blue-600" size={24} />
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Total Patients</p>
                <h3 className="text-3xl font-bold text-gray-800">{stats.totalPatients}</h3>
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-500">New this month</span>
              <span className="text-xs font-bold text-blue-600">+{stats.newPatientsThisMonth}</span>
            </div>
          </div>

          {/* Appointments Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Calendar className="text-purple-600" size={24} />
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Total Appointments</p>
                <h3 className="text-3xl font-bold text-gray-800">{stats.totalAppointments}</h3>
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-500">This week</span>
              <div className="flex items-center gap-1">
                {appointmentGrowth.isPositive ? <ArrowUp size={12} className="text-green-600" /> : <ArrowDown size={12} className="text-red-600" />}
                <span className={`text-xs font-bold ${appointmentGrowth.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {appointmentGrowth.value}%
                </span>
              </div>
            </div>
          </div>

          {/* Dentists Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-cyan-100 rounded-lg flex items-center justify-center">
                <Stethoscope className="text-cyan-600" size={24} />
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Total Dentists</p>
                <h3 className="text-3xl font-bold text-gray-800">{stats.totalDentists}</h3>
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-500">Active</span>
              <span className="text-xs font-bold text-cyan-600">{stats.activeDentists}</span>
            </div>
          </div>
        </div>

        {/* Financial Summary - 2 Cards in Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Total Clinic Earnings Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <PiggyBank className="text-green-600" size={24} />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-1">Total Clinic Earnings</p>
                <h3 className="text-3xl font-bold text-green-700">₱{billingSummary.totalEarnings.toLocaleString()}</h3>
                <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-3">
                  <span className="text-xs text-gray-500">This month</span>
                  <span className="text-xs font-bold text-green-600">₱{billingSummary.monthEarnings.toLocaleString()}</span>
                  {(() => {
                    const prev = billingSummary.lastMonthEarnings;
                    const curr = billingSummary.monthEarnings;
                    let growth = 0, isPositive = true;
                    if (prev === 0 && curr > 0) { growth = 100; isPositive = true; }
                    else if (prev === 0 && curr === 0) { growth = 0; isPositive = true; }
                    else { growth = Math.round(((curr - prev) / prev) * 100); isPositive = growth >= 0; }
                    if (growth > 100) growth = 100;
                    if (growth < -100) growth = -100;
                    return (
                      <span className={`ml-2 flex items-center text-xs font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                        {isPositive ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                        <span className="ml-1">{Math.abs(growth)}%</span>
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* Total Unpaid Balances Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <CreditCard className="text-red-600" size={24} />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-1">Total Unpaid Balances</p>
                <h3 className="text-3xl font-bold text-red-700">₱{billingSummary.totalUnpaid.toLocaleString()}</h3>
                <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-3">
                  <span className="text-xs text-gray-500">This month</span>
                  <span className="text-xs font-bold text-red-600">₱{billingSummary.monthUnpaid.toLocaleString()}</span>
                  {(() => {
                    const prev = billingSummary.lastMonthUnpaid;
                    const curr = billingSummary.monthUnpaid;
                    let growth = 0, isPositive = true;
                    if (prev === 0 && curr > 0) { growth = 100; isPositive = true; }
                    else if (prev === 0 && curr === 0) { growth = 0; isPositive = true; }
                    else { growth = Math.round(((curr - prev) / prev) * 100); isPositive = growth >= 0; }
                    if (growth > 100) growth = 100;
                    if (growth < -100) growth = -100;
                    return (
                      <span className={`ml-2 flex items-center text-xs font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                        {isPositive ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                        <span className="ml-1">{Math.abs(growth)}%</span>
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Patient Demographics - 2 Cards in Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Gender Pie Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-800">Patient Gender Breakdown</h2>
              <p className="text-xs text-gray-500 mt-1">Distribution by gender</p>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={stats.patientGenderStats}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  nameKey="name"
                >
                  {stats.patientGenderStats.map((entry, index) => (
                    <Cell key={`cell-gender-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={36}
                  iconType="circle"
                  wrapperStyle={{ fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Age Group Bar Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-800">Patient Age Groups</h2>
              <p className="text-xs text-gray-500 mt-1">Distribution by age group</p>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.patientAgeStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '12px' }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {stats.patientAgeStats.map((entry, index) => (
                    <Cell key={`cell-age-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Weekly Appointments Chart - Full Width */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Weekly Appointments</h2>
              <p className="text-xs text-gray-500 mt-1">Last 7 days overview</p>
            </div>
            <div className="flex gap-3 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <span className="text-gray-600">Pending</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-gray-600">Approved</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-gray-600">Completed</span>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.appointmentsByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis 
                dataKey="day" 
                tick={{ fontSize: 12, fill: '#9ca3af' }}
                axisLine={false}
              />
              <YAxis 
                tick={{ fontSize: 12, fill: '#9ca3af' }}
                axisLine={false}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              <Bar dataKey="pending" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
              <Bar dataKey="approved" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
              <Bar dataKey="completed" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Charts Row - 3 columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Monthly Revenue Line Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-800">Monthly Revenue</h2>
              <p className="text-xs text-gray-500 mt-1">Last 12 months earnings</p>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={stats.revenueByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '12px' }} />
                <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-6">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Highest Month</span>
                <span className="text-xs font-bold text-green-700">
                  ₱{Math.max(...stats.revenueByMonth.map(m => m.revenue || 0)).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-gray-500">Lowest Month</span>
                <span className="text-xs font-bold text-red-700">
                  ₱{Math.min(...stats.revenueByMonth.map(m => m.revenue || 0)).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-gray-500">Average</span>
                <span className="text-xs font-bold text-blue-700">
                  ₱{(stats.revenueByMonth.reduce((a, b) => a + (b.revenue || 0), 0) / (stats.revenueByMonth.length || 1)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          </div>

          {/* Top Services/Treatments Pie Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-800">Top Services / Treatments</h2>
              <p className="text-xs text-gray-500 mt-1">Most common procedures (Top 5)</p>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={stats.topTreatments}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  nameKey="name"
                >
                  {stats.topTreatments.map((entry, index) => (
                    <Cell key={`cell-top-treat-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={36}
                  iconType="circle"
                  wrapperStyle={{ fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Status Pie Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-800">Appointment Status</h2>
              <p className="text-xs text-gray-500 mt-1">Current distribution</p>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={stats.appointmentsByStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats.appointmentsByStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={36}
                  iconType="circle"
                  wrapperStyle={{ fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ...existing code... */}

        {/* ...existing code... */}
      </div>
    </div>
  );
}