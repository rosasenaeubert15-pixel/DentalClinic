import React, { useState, useEffect, useMemo } from "react";
import { 
  Eye,
  X,
  Trash2,
  FileText,
  Users,
  Activity,
  Image,
  Calendar,
  Phone,
  Mail,
  MapPin,
  User,
  Download,
  Printer
} from "lucide-react";
import { 
  collection, 
  getDocs, 
  query, 
  where,
  deleteDoc,
  doc
} from "firebase/firestore";
import { db } from "../../../firebase.config";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function DentalRecords() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
  const [patientTreatments, setPatientTreatments] = useState([]);
  const [patientAIProgress, setPatientAIProgress] = useState([]);
  const [patientAIGoals, setPatientAIGoals] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  const [activeTab, setActiveTab] = useState("info");
  const [viewingImage, setViewingImage] = useState(null);
  
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Load all patients with optimized parallel queries
  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      setLoading(true);
      
      // Fetch all data in parallel
      const [usersSnap, appointmentsSnap, onlineSnap] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(query(collection(db, "appointments"), where("status", "==", "treated"))),
        getDocs(query(collection(db, "onlineRequests"), where("status", "==", "treated"))),
      ]);

      // Create lookup maps for faster access
      const treatmentsByUser = new Map();

      // Group appointments by user
      appointmentsSnap.docs.forEach(doc => {
        const userId = doc.data().userId;
        if (!treatmentsByUser.has(userId)) {
          treatmentsByUser.set(userId, 0);
        }
        treatmentsByUser.set(userId, treatmentsByUser.get(userId) + 1);
      });

      // Group online requests by user
      onlineSnap.docs.forEach(doc => {
        const userId = doc.data().userId;
        if (!treatmentsByUser.has(userId)) {
          treatmentsByUser.set(userId, 0);
        }
        treatmentsByUser.set(userId, treatmentsByUser.get(userId) + 1);
      });

      // Process patients and fetch AI images only for those with records
      const patientsWithRecords = [];
      const aiImagePromises = [];

      for (const userDoc of usersSnap.docs) {
        const userData = userDoc.data();
        if (userData.role === "patient") {
          const userId = userDoc.id;
          const treatmentsCount = treatmentsByUser.get(userId) || 0;

          // Only process if they have treatments 
          if (treatmentsCount > 0) {
            patientsWithRecords.push({
              id: userId,
              uid: userId,
              userData,
              treatmentsCount,
              index: patientsWithRecords.length
            });

            // Queue AI image count queries
            aiImagePromises.push(
              countAIImages(userId).then(aiCount => ({ userId, aiCount }))
            );
          }
        }
      }

      // Fetch all AI image counts in parallel
      const aiResults = await Promise.all(aiImagePromises);
      const aiCountsByUser = new Map(aiResults.map(r => [r.userId, r.aiCount]));

      // Build final patient list
      const patientsList = patientsWithRecords
        .map(p => {
          const aiCount = aiCountsByUser.get(p.uid) || 0;
          
          // Include patient if they have any records
          if (p.treatmentsCount > 0 || aiCount > 0) {
            const name = `${p.userData.firstName || ""} ${p.userData.lastName || ""}`.trim() || "Unnamed Patient";
            
            return {
              id: p.uid,
              uid: p.uid,
              name,
              email: p.userData.email || "N/A",
              phone: p.userData.phone || p.userData.contactNumber || "N/A",
              address: p.userData.address || "N/A",
              birthdate: p.userData.birthdate || "N/A",
              gender: p.userData.gender || "N/A",
              recordNumber: `DR-${new Date().getFullYear()}-${String(p.index + 1).padStart(3, "0")}`,
              treatmentsCount: p.treatmentsCount,
              aiCount,
              lastVisit: p.userData.lastVisit || "N/A"
            };
          }
          return null;
        })
        .filter(Boolean);

      setPatients(patientsList);
    } catch (error) {
      console.error("Error loading patients:", error);
      toast.error("Error loading patient records");
    } finally {
      setLoading(false);
    }
  };

  const countAIImages = async (userId) => {
    try {
      const [progressSnap, goalsSnap] = await Promise.all([
        getDocs(collection(db, "users", userId, "aiProgress")),
        getDocs(collection(db, "users", userId, "aiGoals"))
      ]);
      
      return progressSnap.size + goalsSnap.size;
    } catch (error) {
      console.error("Error counting AI images:", error);
      return 0;
    }
  };

  const loadPatientDetails = async (patient) => {
    try {
      setLoadingDetails(true);
      setSelectedPatient(patient);
      setShowDetailsModal(true);
      setActiveTab("info");

      // Load all data in parallel
      const [
        appointmentsSnap,
        onlineSnap,
        progressSnap,
        goalsSnap
      ] = await Promise.all([
        getDocs(query(
          collection(db, "appointments"),
          where("userId", "==", patient.uid),
          where("status", "==", "treated")
        )),
        getDocs(query(
          collection(db, "onlineRequests"),
          where("userId", "==", patient.uid),
          where("status", "==", "treated")
        )),
        getDocs(collection(db, "users", patient.uid, "aiProgress")),
        getDocs(collection(db, "users", patient.uid, "aiGoals"))
      ]);

      // Process treatments
      const treatments = [];
      
      appointmentsSnap.forEach(doc => {
        const data = doc.data();
        treatments.push({
          id: doc.id,
          date: data.date || "N/A",
          treatment: data.treatment || "N/A",
          treatmentOption: data.treatmentOption || "",
          teethNo: data.teethNo || "N/A",
          dentalIssue: data.dentalIssue || "N/A",
          description: data.description || "N/A",
          remarks: data.additionalNotes || "N/A",
          timestamp: data.createdAt || data.date || ""
        });
      });
      
      onlineSnap.forEach(doc => {
        const data = doc.data();
        treatments.push({
          id: doc.id,
          date: data.date || "N/A",
          treatment: data.treatment || "N/A",
          treatmentOption: data.treatmentOption || "",
          teethNo: data.teethNo || "N/A",
          dentalIssue: data.dentalIssue || "N/A",
          description: data.description || "N/A",
          remarks: data.additionalNotes || "N/A",
          timestamp: data.createdAt || data.date || ""
        });
      });
      
      // Sort treatments by date
      treatments.sort((a, b) => new Date(b.date) - new Date(a.date));
      setPatientTreatments(treatments);

      // Process AI images
      const progress = progressSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
      setPatientAIProgress(progress);

      const goals = goalsSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
      setPatientAIGoals(goals);

    } catch (error) {
      console.error("Error loading patient details:", error);
      toast.error("Error loading patient details");
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleDeletePatient = async (patient) => {
    if (!window.confirm(`Are you sure you want to delete all records for ${patient.name}? This action cannot be undone.`)) {
      return;
    }

    try {
      const userId = patient.uid;
      
      // Query all documents to delete
      const [appointmentsSnap, onlineSnap, progressSnap, goalsSnap] = await Promise.all([
        getDocs(query(
          collection(db, "appointments"),
          where("userId", "==", userId),
          where("status", "==", "treated")
        )),
        getDocs(query(
          collection(db, "onlineRequests"),
          where("userId", "==", userId),
          where("status", "==", "treated")
        )),
        getDocs(collection(db, "users", userId, "aiProgress")),
        getDocs(collection(db, "users", userId, "aiGoals"))
      ]);

      // Delete all documents in parallel
      const deletePromises = [
        ...appointmentsSnap.docs.map(d => deleteDoc(doc(db, "appointments", d.id))),
        ...onlineSnap.docs.map(d => deleteDoc(doc(db, "onlineRequests", d.id))),
        ...progressSnap.docs.map(d => deleteDoc(doc(db, "users", userId, "aiProgress", d.id))),
        ...goalsSnap.docs.map(d => deleteDoc(doc(db, "users", userId, "aiGoals", d.id)))
      ];

      await Promise.all(deletePromises);
      
      // Update local state
      setPatients(prev => prev.filter(p => p.uid !== userId));
      
      toast.success("Patient dental records deleted successfully");
      
    } catch (error) {
      console.error("Error deleting patient records:", error);
      toast.error("Failed to delete patient records");
    }
  };

  // Print function
  const handlePrint = () => {
    window.print();
  };

  // Export CSV function
  const handleExportCSV = () => {
    const headers = ["Record No.", "Patient Name", "Email", "Phone", "Treatments", "AI Images"];
    const rows = filteredPatients.map(p => [
      p.recordNumber,
      p.name,
      p.email,
      p.phone,
      p.treatmentsCount,
      p.aiCount
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dental-records-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success("CSV exported successfully!");
  };

  // Memoized filtered patients
  const filteredPatients = useMemo(() => {
    if (!searchTerm.trim()) return patients;
    
    const needle = searchTerm.toLowerCase();
    return patients.filter(p => 
      p.name.toLowerCase().includes(needle) ||
      p.email?.toLowerCase().includes(needle) ||
      p.recordNumber?.toLowerCase().includes(needle)
    );
  }, [searchTerm, patients]);

  // Memoized pagination
  const { currentEntries, totalPages, indexOfFirstEntry, indexOfLastEntry } = useMemo(() => {
    const indexOfLastEntry = currentPage * entriesPerPage;
    const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
    const currentEntries = filteredPatients.slice(indexOfFirstEntry, indexOfLastEntry);
    const totalPages = Math.ceil(filteredPatients.length / entriesPerPage);
    
    return { currentEntries, totalPages, indexOfFirstEntry, indexOfLastEntry };
  }, [currentPage, entriesPerPage, filteredPatients]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const totalPatients = patients.length;
  const totalTreatments = patients.reduce((sum, p) => sum + p.treatmentsCount, 0);
  const totalAIImages = patients.reduce((sum, p) => sum + p.aiCount, 0);

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <ToastContainer position="top-right" autoClose={3000} />
      
      <div className="max-w-[1400px] mx-auto">

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="bg-white rounded border-2 border-gray-400 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Patients</p>
                <p className="text-3xl font-bold text-gray-800">{totalPatients}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Users className="text-blue-600" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded border-2 border-gray-400 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Treatments</p>
                <p className="text-3xl font-bold text-gray-800">{totalTreatments}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <Activity className="text-green-600" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded border-2 border-gray-400 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">AI Images</p>
                <p className="text-3xl font-bold text-gray-800">{totalAIImages}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Image className="text-purple-600" size={24} />
              </div>
            </div>
          </div>
        </div>

        {/* Main Table Section */}
        <div className="bg-white rounded border border-gray-300 p-4">
          {/* Controls */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">Show</span>
              <select
                value={entriesPerPage}
                onChange={(e) => {
                  setEntriesPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="border border-gray-400 rounded px-2 py-1 text-xs bg-white"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={15}>15</option>
              </select>
              <span className="text-xs text-gray-600">entries</span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search patients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border border-gray-400 rounded px-3 py-1 text-xs w-64 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none"
              />
              <button
                onClick={handlePrint}
                className="px-3 py-1.5 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors flex items-center gap-1.5 text-xs font-medium"
                title="Print Records"
              >
                <Printer size={14} />
                Print
              </button>
              <button
                onClick={handleExportCSV}
                className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center gap-1.5 text-xs font-medium"
                title="Export to CSV"
              >
                <Download size={14} />
                Export CSV
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-gray-400 rounded">
            <table className="w-full text-xs">
              <thead className="bg-gray-100 border-b border-gray-400">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700 border-r border-gray-300">
                    Record No.
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700 border-r border-gray-300">
                    Patient Name
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700 border-r border-gray-300">
                    Contact
                  </th>
                  <th className="text-center px-3 py-2 font-semibold text-gray-700 border-r border-gray-300">
                    Treatments
                  </th>
                  <th className="text-center px-3 py-2 font-semibold text-gray-700">
                    AI Images
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-gray-500">
                      Loading...
                    </td>
                  </tr>
                ) : currentEntries.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-gray-500">
                      No patients found
                    </td>
                  </tr>
                ) : (
                  currentEntries.map((patient, idx) => (
                    <tr
                      key={patient.id}
                      onClick={() => loadPatientDetails(patient)}
                      className={`border-b border-gray-300 hover:bg-blue-50 cursor-pointer transition-colors ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                      }`}
                      title="Click to view details"
                    >
                      <td className="px-3 py-2 border-r border-gray-200">
                        <span className="font-mono text-xs text-gray-700">{patient.recordNumber}</span>
                      </td>
                      <td className="px-3 py-2 border-r border-gray-200">
                        <div className="font-medium text-gray-800">{patient.name}</div>
                      </td>
                      <td className="px-3 py-2 border-r border-gray-200">
                        <div className="text-gray-600">{patient.email}</div>
                        <div className="text-gray-500 text-[10px]">{patient.phone}</div>
                      </td>
                      <td className="px-3 py-2 text-center border-r border-gray-200">
                        <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-700 rounded-full font-semibold">
                          {patient.treatmentsCount}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 bg-purple-100 text-purple-700 rounded-full font-semibold">
                          {patient.aiCount}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex justify-between items-center mt-4">
            <div className="text-xs text-gray-700">
              Showing {indexOfFirstEntry + 1} to {Math.min(indexOfLastEntry, filteredPatients.length)} of {filteredPatients.length} entries
            </div>

            <div className="flex gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-xs border border-gray-400 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>

              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-1 text-xs border rounded ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-400 hover:bg-gray-100'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-xs border border-gray-400 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Patient Details Modal */}
      {showDetailsModal && selectedPatient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-300 px-6 py-4 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-800">{selectedPatient.name}</h2>
                <p className="text-sm text-gray-600 font-mono">{selectedPatient.recordNumber}</p>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-300 px-6 bg-gray-50">
              <div className="flex gap-1">
                <button
                  onClick={() => setActiveTab("info")}
                  className={`px-4 py-2.5 text-sm font-medium transition ${
                    activeTab === "info"
                      ? "bg-white border-t-2 border-blue-600 text-gray-800"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  Patient Info
                </button>
                <button
                  onClick={() => setActiveTab("treatments")}
                  className={`px-4 py-2.5 text-sm font-medium transition ${
                    activeTab === "treatments"
                      ? "bg-white border-t-2 border-blue-600 text-gray-800"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  Treatments ({patientTreatments.length})
                </button>
                <button
                  onClick={() => setActiveTab("ai")}
                  className={`px-4 py-2.5 text-sm font-medium transition ${
                    activeTab === "ai"
                      ? "bg-white border-t-2 border-blue-600 text-gray-800"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  AI Images ({patientAIProgress.length + patientAIGoals.length})
                </button>
              </div>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {loadingDetails ? (
                <div className="text-center py-8 text-gray-500">
                  Loading patient details...
                </div>
              ) : (
                <>
                  {/* Patient Info Tab */}
                  {activeTab === "info" && (
                    <div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <User className="text-blue-600" size={18} />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Full Name</p>
                            <p className="font-semibold text-gray-800">{selectedPatient.name}</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <Mail className="text-green-600" size={18} />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Email</p>
                            <p className="font-semibold text-gray-800">{selectedPatient.email}</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <Phone className="text-purple-600" size={18} />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Phone</p>
                            <p className="font-semibold text-gray-800">{selectedPatient.phone}</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <Calendar className="text-orange-600" size={18} />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Birthdate</p>
                            <p className="font-semibold text-gray-800">{selectedPatient.birthdate}</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3 md:col-span-2">
                          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <MapPin className="text-red-600" size={18} />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Address</p>
                            <p className="font-semibold text-gray-800">{selectedPatient.address}</p>
                          </div>
                        </div>
                      </div>

                      {/* Summary Cards */}
                      <div className="mt-6 pt-6 border-t border-gray-300">
                        <h3 className="text-sm font-bold text-gray-700 mb-4">Record Summary</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="border border-gray-300 rounded p-4 bg-blue-50">
                            <p className="text-2xl font-bold text-blue-700">{patientTreatments.length}</p>
                            <p className="text-xs text-gray-600 mt-1">Total Treatments</p>
                          </div>
                          <div className="border border-gray-300 rounded p-4 bg-purple-50">
                            <p className="text-2xl font-bold text-purple-700">
                              {patientAIProgress.length + patientAIGoals.length}
                            </p>
                            <p className="text-xs text-gray-600 mt-1">Total AI Images</p>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="mt-6 pt-6 border-t border-gray-300">
                        <h3 className="text-sm font-bold text-gray-700 mb-3">Actions</h3>
                        <div className="flex gap-2">
                          <button
                            onClick={handlePrint}
                            className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors font-medium flex items-center justify-center gap-2"
                          >
                            <Printer size={16} />
                            Print Record
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`Delete all records for ${selectedPatient.name}? This action cannot be undone.`)) {
                                handleDeletePatient(selectedPatient);
                                setShowDetailsModal(false);
                              }
                            }}
                            className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors font-medium flex items-center justify-center gap-2"
                          >
                            <Trash2 size={16} />
                            Delete All Records
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Treatments Tab */}
                  {activeTab === "treatments" && (
                    <div>
                      {patientTreatments.length === 0 ? (
                        <div className="text-center py-12">
                          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                          <p className="text-gray-500">No treatments recorded</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {patientTreatments.map((treatment, idx) => (
                            <div key={idx} className="border border-gray-300 rounded p-4 bg-gray-50">
                              <div className="flex justify-between items-start mb-3 pb-3 border-b border-gray-300">
                                <div>
                                  <h4 className="font-bold text-gray-800">{treatment.treatment}</h4>
                                  {treatment.treatmentOption && (
                                    <p className="text-xs text-gray-600 mt-1">{treatment.treatmentOption}</p>
                                  )}
                                </div>
                                <span className="text-xs font-medium text-gray-600 bg-white px-2 py-1 rounded border border-gray-300">
                                  {treatment.date}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                                <div>
                                  <span className="text-gray-500">Teeth No.:</span>
                                  <span className="ml-2 text-gray-800 font-medium">{treatment.teethNo}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Issue:</span>
                                  <span className="ml-2 text-gray-800 font-medium">{treatment.dentalIssue}</span>
                                </div>
                              </div>
                              <div className="text-xs">
                                <p className="text-gray-500 mb-1">Description:</p>
                                <p className="text-gray-800">{treatment.description}</p>
                              </div>
                              {treatment.remarks !== "N/A" && (
                                <div className="text-xs mt-2">
                                  <p className="text-gray-500 mb-1">Remarks:</p>
                                  <p className="text-gray-800">{treatment.remarks}</p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* AI Images Tab */}
                  {activeTab === "ai" && (
                    <div>
                      {patientAIProgress.length === 0 && patientAIGoals.length === 0 ? (
                        <div className="text-center py-12">
                          <Image className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                          <p className="text-gray-500">No AI images uploaded</p>
                        </div>
                      ) : (
                        <div>
                          {/* Progress Images */}
                          {patientAIProgress.length > 0 && (
                            <div className="mb-6">
                              <h3 className="text-sm font-bold text-gray-700 mb-3">Progress Images</h3>
                              <div className="grid grid-cols-3 gap-3">
                                {patientAIProgress.map((img, idx) => (
                                  <div 
                                    key={img.id} 
                                    className="relative group border-2 border-blue-300 rounded overflow-hidden cursor-pointer"
                                    onClick={() => setViewingImage(img.imageUrl)}
                                  >
                                    <img
                                      src={img.imageUrl}
                                      alt={`Progress ${idx + 1}`}
                                      className="w-full h-32 object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                                      <Eye className="text-white" size={24} />
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 bg-blue-600 text-white text-xs px-2 py-1 text-center font-medium">
                                      Step {idx + 1}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Goal Images */}
                          {patientAIGoals.length > 0 && (
                            <div>
                              <h3 className="text-sm font-bold text-gray-700 mb-3">Goal Images</h3>
                              <div className="grid grid-cols-3 gap-3">
                                {patientAIGoals.map((img, idx) => (
                                  <div 
                                    key={img.id} 
                                    className="relative group border-2 border-green-300 rounded overflow-hidden cursor-pointer"
                                    onClick={() => setViewingImage(img.imageUrl)}
                                  >
                                    <img
                                      src={img.imageUrl}
                                      alt={`Goal ${idx + 1}`}
                                      className="w-full h-32 object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                                      <Eye className="text-white" size={24} />
                                    </div>
                                    <div className="absolute top-2 right-2 bg-green-600 text-white text-xs px-2 py-1 rounded font-medium">
                                      Goal
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Image Viewer Modal */}
      {viewingImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[60] p-4"
          onClick={() => setViewingImage(null)}
        >
          <div className="max-w-5xl max-h-[90vh] relative">
            <img
              src={viewingImage}
              alt="View"
              className="max-w-full max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setViewingImage(null)}
              className="absolute top-4 right-4 bg-white text-gray-700 p-2 rounded hover:bg-gray-100"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}