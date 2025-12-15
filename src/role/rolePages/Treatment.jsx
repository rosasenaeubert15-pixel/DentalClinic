import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../../firebase.config";
import { 
  Pencil, 
  Trash2, 
  X,
  User,
  Calendar,
  FileText,
  Stethoscope,
  Eye
} from "lucide-react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function Treatment() {
  const [treatments, setTreatments] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [patients, setPatients] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTreatment, setSelectedTreatment] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [viewedTreatments, setViewedTreatments] = useState(new Set());

  const [editForm, setEditForm] = useState({
    patientId: "",
    patientName: "",
    dateVisit: "",
    treatment: "",
    teethNo: "",
    dentalIssue: "",
    description: "",
    remarks: "",
  });

  // Load viewed treatments from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('viewedTreatments');
    if (saved) {
      try {
        setViewedTreatments(new Set(JSON.parse(saved)));
      } catch (e) {
        console.error('Failed to load viewed treatments:', e);
      }
    }
  }, []);

  // Check if treatment is new (created in last 24 hours and not viewed)
  const isNewTreatment = (treatment) => {
    if (viewedTreatments.has(treatment.id)) return false;
    
    if (!treatment.createdAt) return false;
    
    try {
      let createdDate;
      if (typeof treatment.createdAt === 'object' && typeof treatment.createdAt.toDate === 'function') {
        createdDate = treatment.createdAt.toDate();
      } else if (typeof treatment.createdAt === 'object' && typeof treatment.createdAt.toMillis === 'function') {
        createdDate = new Date(treatment.createdAt.toMillis());
      } else {
        createdDate = new Date(treatment.createdAt);
      }
      
      const now = new Date();
      const hoursDiff = (now - createdDate) / (1000 * 60 * 60);
      
      return hoursDiff <= 24;
    } catch (e) {
      return false;
    }
  };

  useEffect(() => {
    async function loadUsers() {
      try {
        const snap = await getDocs(collection(db, "users"));
        const data = {};
        snap.forEach((d) => (data[d.id] = d.data()));
        setPatients(data);
      } catch (e) {
        console.error("load users error:", e);
      }
    }
    loadUsers();
  }, []);

  useEffect(() => {
    const unsubscribers = [];

    const appointmentsQuery = query(
      collection(db, "appointments"),
      where("status", "==", "treated")
    );
    const unsubAppt = onSnapshot(appointmentsQuery, (snap) => {
      const appointmentTreatments = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          source: "appointment",
          patientId: data.userId || null,
          patientName: data.patientName || "Unknown",
          dateVisit: data.date || "N/A",
          treatment: data.treatment || "N/A",
          treatmentOption: data.treatmentOption || "",
          teethNo: data.teethNo || "",
          dentalIssue: data.dentalIssue || "",
          description: data.description || "",
          remarks: data.additionalNotes || "",
          createdAt: data.createdAt,
        };
      });

      const onlineQuery = query(
        collection(db, "onlineRequests"),
        where("status", "==", "treated")
      );
      const unsubOnline = onSnapshot(onlineQuery, (onlineSnap) => {
        const onlineTreatments = onlineSnap.docs.map((d) => {
          const data = d.data();
          const patName = getPatientName(data.userId);
          return {
            id: d.id,
            source: "onlineRequest",
            patientId: data.userId || null,
            patientName: patName,
            dateVisit: data.date || "N/A",
            treatment: data.treatment || "N/A",
            treatmentOption: data.treatmentOption || "",
            teethNo: data.teethNo || "",
            dentalIssue: data.dentalIssue || "",
            description: data.description || "",
            remarks: data.additionalNotes || "",
            createdAt: data.createdAt,
          };
        });

        const allTreatments = [...appointmentTreatments, ...onlineTreatments];
        setTreatments(allTreatments);
        setFiltered(allTreatments);
        setLoading(false);
      });

      unsubscribers.push(unsubOnline);
    });

    unsubscribers.push(unsubAppt);

    return () => {
      unsubscribers.forEach((unsub) => unsub && unsub());
    };
  }, [patients]);

  const getPatientName = (userId) => {
    const u = patients[userId];
    return u ? `${u.firstName || ""} ${u.lastName || ""}`.trim() || "Unknown" : "Unknown";
  };

  useEffect(() => {
    let result = treatments;

    if (search.trim()) {
      const needle = search.toLowerCase();
      result = result.filter((t) => {
        return (
          t.patientName?.toLowerCase().includes(needle) ||
          t.treatment?.toLowerCase().includes(needle) ||
          t.dentalIssue?.toLowerCase().includes(needle) ||
          t.description?.toLowerCase().includes(needle) ||
          t.remarks?.toLowerCase().includes(needle)
        );
      });
    }

    setFiltered(result);
    setCurrentPage(1);
  }, [treatments, search]);

  const indexOfLastEntry = currentPage * entriesPerPage;
  const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
  const currentEntries = filtered.slice(indexOfFirstEntry, indexOfLastEntry);
  const totalPages = Math.ceil(filtered.length / entriesPerPage);

  function openDetailsModal(treatment) {
    setSelectedTreatment(treatment);
    setShowDetailsModal(true);
    
    // Mark as viewed
    const newViewed = new Set(viewedTreatments);
    newViewed.add(treatment.id);
    setViewedTreatments(newViewed);
    
    // Save to localStorage
    try {
      localStorage.setItem('viewedTreatments', JSON.stringify([...newViewed]));
    } catch (e) {
      console.error('Failed to save viewed treatments:', e);
    }
  }

  function openEditModal(treatment) {
    setSelectedTreatment(treatment);
    setEditForm({
      patientId: treatment.patientId || "",
      patientName: treatment.patientName || "",
      dateVisit: treatment.dateVisit || "",
      treatment: treatment.treatment || "",
      teethNo: treatment.teethNo || "",
      dentalIssue: treatment.dentalIssue || "",
      description: treatment.description || "",
      remarks: treatment.remarks || "",
      source: treatment.source,
    });
    setShowDetailsModal(false);
    setShowEditModal(true);
  }

  function closeEditModal() {
    setShowEditModal(false);
    setEditForm({
      patientId: "",
      patientName: "",
      dateVisit: "",
      treatment: "",
      teethNo: "",
      dentalIssue: "",
      description: "",
      remarks: "",
    });
  }

  async function handleEditSubmit() {
    if (!selectedTreatment) return;

    setSubmitting(true);
    try {
      const treatment = treatments.find((t) => t.id === selectedTreatment.id);
      if (!treatment) {
        toast.error("Treatment not found");
        return;
      }

      const collectionName = treatment.source === "appointment" ? "appointments" : "onlineRequests";
      const docRef = doc(db, collectionName, selectedTreatment.id);

      await updateDoc(docRef, {
        teethNo: editForm.teethNo,
        dentalIssue: editForm.dentalIssue,
        description: editForm.description,
        additionalNotes: editForm.remarks,
        updatedAt: serverTimestamp(),
      });

      toast.success("Treatment updated successfully");
      closeEditModal();
    } catch (err) {
      console.error("handleEditSubmit error:", err);
      toast.error("Failed to update treatment");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Are you sure you want to delete this treatment record?")) return;

    try {
      const treatment = treatments.find((t) => t.id === id);
      if (!treatment) {
        toast.error("Treatment not found");
        return;
      }

      const collectionName = treatment.source === "appointment" ? "appointments" : "onlineRequests";
      await deleteDoc(doc(db, collectionName, id));
      toast.success("Treatment deleted successfully");
      setShowDetailsModal(false);
    } catch (err) {
      console.error("handleDelete error:", err);
      toast.error("Failed to delete treatment");
    }
  }

  function getInitials(name) {
    if (!name) return "?";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name[0].toUpperCase();
  }

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push("...");
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push("...");
        pages.push(totalPages);
      }
    }

    return pages;
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <ToastContainer position="top-right" autoClose={3000} />
      
      <div className="max-w-[1400px] mx-auto">
        {/* Status Card */}
        <div className="bg-white rounded border border-gray-300 p-4 mb-4">
          <div className="grid grid-cols-1 gap-3">
            <div className="border-2 border-blue-300 rounded p-3 text-center bg-blue-50">
              <div className="text-2xl font-bold text-blue-600">{filtered.length}</div>
              <div className="text-[10px] text-gray-600 font-semibold mt-1">
                TOTAL TREATMENTS
              </div>
            </div>
          </div>
        </div>

        {/* Main Table */}
        <div className="bg-white rounded border border-gray-300 p-4">
          {/* Controls Bar */}
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
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span className="text-xs text-gray-600">entries</span>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search treatments..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border border-gray-400 rounded px-3 py-1 text-xs w-64 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-gray-400 rounded">
            <table className="w-full text-xs">
              <thead className="bg-gray-100 border-b border-gray-400">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700 border-r border-gray-300">
                    Patient
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700 border-r border-gray-300">
                    Date Visit
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700">
                    Treatment
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="3" className="text-center py-8 text-gray-500">
                      Loading treatments...
                    </td>
                  </tr>
                ) : currentEntries.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="text-center py-8 text-gray-500">
                      No treatments found.
                    </td>
                  </tr>
                ) : (
                  currentEntries.map((treatment, idx) => {
                    const isNew = isNewTreatment(treatment);
                    return (
                      <tr 
                        key={treatment.id} 
                        onClick={() => openDetailsModal(treatment)}
                        className={`border-b border-gray-300 transition-colors cursor-pointer ${
                          isNew 
                            ? 'bg-blue-50 hover:bg-blue-100 font-medium' 
                            : 'hover:bg-blue-50'
                        }`}
                        title={isNew ? 'New treatment - click to view' : 'Click to view details'}
                      >
                        <td className="px-3 py-2 border-r border-gray-200">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white font-semibold text-xs shadow flex-shrink-0">
                              {getInitials(treatment.patientName)}
                            </div>
                            <span className="font-medium text-gray-800">{treatment.patientName}</span>
                            {isNew && (
                              <span className="ml-auto px-1.5 py-0.5 bg-blue-600 text-white rounded text-[9px] font-bold">
                                NEW
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 border-r border-gray-200 text-gray-700">
                          {treatment.dateVisit}
                        </td>
                        <td className="px-3 py-2">
                          <div>
                            <div className="font-medium text-gray-800">{treatment.treatment}</div>
                            {treatment.treatmentOption && (
                              <div className="text-[10px] text-gray-500 mt-0.5">{treatment.treatmentOption}</div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-xs text-gray-700">
              Showing <span className="font-medium">{filtered.length === 0 ? 0 : indexOfFirstEntry + 1}</span> to{" "}
              <span className="font-medium">{Math.min(indexOfLastEntry, filtered.length)}</span> of{" "}
              <span className="font-medium">{filtered.length}</span> entries
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-xs border border-gray-400 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>

              <div className="flex gap-1">
                {getPageNumbers().map((page, idx) =>
                  page === "..." ? (
                    <span key={`ellipsis-${idx}`} className="px-2 py-1 text-xs">
                      ...
                    </span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1 text-xs border rounded ${
                        currentPage === page
                          ? "bg-blue-600 text-white border-blue-600"
                          : "border-gray-400 hover:bg-gray-100"
                      }`}
                    >
                      {page}
                    </button>
                  )
                )}
              </div>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-xs border border-gray-400 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedTreatment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-300 px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white font-bold text-lg shadow-md">
                  {getInitials(selectedTreatment.patientName)}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Treatment Details</h2>
                  <p className="text-sm text-gray-500">{selectedTreatment.patientName}</p>
                </div>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="space-y-4">
                {/* Patient & Visit Information */}
                <div className="bg-gray-50 border border-gray-300 p-4 rounded">
                  <h3 className="font-semibold text-gray-700 mb-3 text-sm">
                    Patient & Visit Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="text-blue-600" size={18} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Patient Name</p>
                        <p className="font-medium text-gray-800 text-sm">
                          {selectedTreatment.patientName}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Calendar className="text-purple-600" size={18} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Date Visit</p>
                        <p className="font-medium text-gray-800 text-sm">
                          {selectedTreatment.dateVisit}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Treatment Information */}
                <div className="bg-gray-50 border border-gray-300 p-4 rounded">
                  <h3 className="font-semibold text-gray-700 mb-3 text-sm">
                    Treatment Information
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Stethoscope className="text-green-600" size={18} />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 mb-1">Treatment</p>
                        <p className="font-medium text-gray-800 text-sm">
                          {selectedTreatment.treatment}
                        </p>
                        {selectedTreatment.treatmentOption && (
                          <p className="text-xs text-gray-600 mt-1">
                            {selectedTreatment.treatmentOption}
                          </p>
                        )}
                      </div>
                    </div>

                    {selectedTreatment.teethNo && (
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <FileText className="text-orange-600" size={18} />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-gray-500 mb-1">Teeth No./s</p>
                          <p className="font-medium text-gray-800 text-sm">
                            {selectedTreatment.teethNo}
                          </p>
                        </div>
                      </div>
                    )}

                    {selectedTreatment.dentalIssue && (
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <FileText className="text-red-600" size={18} />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-gray-500 mb-1">Dental Issue</p>
                          <p className="font-medium text-gray-800 text-sm">
                            {selectedTreatment.dentalIssue}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Additional Details */}
                {(selectedTreatment.description || selectedTreatment.remarks) && (
                  <div className="bg-gray-50 border border-gray-300 p-4 rounded">
                    <h3 className="font-semibold text-gray-700 mb-3 text-sm">
                      Additional Details
                    </h3>
                    <div className="space-y-3">
                      {selectedTreatment.description && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Description</p>
                          <p className="text-sm text-gray-800">
                            {selectedTreatment.description}
                          </p>
                        </div>
                      )}
                      {selectedTreatment.remarks && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Remarks</p>
                          <p className="text-sm text-gray-800">
                            {selectedTreatment.remarks}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="pt-4 border-t border-gray-300">
                  <h3 className="font-semibold text-gray-700 mb-3 text-sm">
                    Actions
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => openEditModal(selectedTreatment)}
                      className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2 transition-colors"
                    >
                      <Pencil size={16} />
                      Edit Treatment
                    </button>

                    <button
                      onClick={() => handleDelete(selectedTreatment.id)}
                      className="px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center justify-center gap-2 transition-colors"
                    >
                      <Trash2 size={16} />
                      Delete Treatment
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedTreatment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4 border-b pb-3">
                <h3 className="text-xl font-semibold text-gray-700">Edit Treatment</h3>
                <button
                  onClick={closeEditModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Patient Name
                  </label>
                  <input
                    type="text"
                    value={editForm.patientName}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-100 text-gray-700 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date Visit
                  </label>
                  <input
                    type="text"
                    value={editForm.dateVisit}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-100 text-gray-700 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Treatment
                  </label>
                  <input
                    type="text"
                    value={editForm.treatment}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-100 text-gray-700 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Teeth No./s
                  </label>
                  <input
                    type="text"
                    value={editForm.teethNo}
                    onChange={(e) => setEditForm({ ...editForm, teethNo: e.target.value })}
                    placeholder="Enter teeth number/s"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dental Issue
                  </label>
                  <input
                    type="text"
                    value={editForm.dentalIssue}
                    onChange={(e) => setEditForm({ ...editForm, dentalIssue: e.target.value })}
                    placeholder="Enter dental issue"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    placeholder="Enter description"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Remarks
                  </label>
                  <textarea
                    value={editForm.remarks}
                    onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })}
                    placeholder="Enter remarks..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    onClick={closeEditModal}
                    className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEditSubmit}
                    disabled={submitting}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                  >
                    {submitting ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}