import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../../firebase.config";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit
} from "firebase/firestore";
import {
  onAuthStateChanged,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updateEmail,
  updatePassword
} from "firebase/auth";
import { ToastContainer, toast } from "react-toastify";
import { 
  Camera, 
  Trash2, 
  X, 
  Save, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar as CalendarIcon, 
  Users,
  Edit2,
  Lock,
  Activity,
  FileText
} from "lucide-react";
import "react-toastify/dist/ReactToastify.css";

export default function PatientProfile() {
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);
  const [userDoc, setUserDoc] = useState(null);

  const [editing, setEditing] = useState(false);
  const [emailEditing, setEmailEditing] = useState(false);
  const [emailReauthPassword, setEmailReauthPassword] = useState("");

  const [previewImage, setPreviewImage] = useState("");

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    contactNumber: "",
    address: "",
    gender: "",
    birthdate: "",
    avatarUrl: "",
  });

  // Password modal
  const [pwModal, setPwModal] = useState(false);
  const [curPassword, setCurPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    totalAppointments: 0,
    upcomingAppointments: 0,
    completedTreatments: 0,
    lastVisit: "N/A"
  });

  // Recent activity
  const [recentActivity, setRecentActivity] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(true);

  // Load user data
  useEffect(() => {
    setLoading(true);
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        setUserDoc(null);
        setLoading(false);
        return;
      }
      setUser(u);

      try {
        const uRef = doc(db, "users", u.uid);
        const snap = await getDoc(uRef);
        if (snap.exists()) {
          const data = snap.data();
          setUserDoc(data);
          setForm({
            firstName: data.firstName || "",
            lastName: data.lastName || "",
            email: data.email || u.email || "",
            contactNumber: data.contactNumber || "",
            address: data.address || "",
            gender: data.gender || "",
            birthdate: data.birthdate || "",
            avatarUrl: data.avatarUrl || "",
          });
          setPreviewImage(data.avatarUrl || "");

          // Load stats and activity
          await loadUserStats(u.uid);
          await loadRecentActivity(u.uid);
        } else {
          const initial = {
            firstName: u.displayName ? u.displayName.split(" ")[0] : "",
            lastName: u.displayName
              ? u.displayName.split(" ").slice(1).join(" ")
              : "",
            email: u.email || "",
            contactNumber: u.phoneNumber || "",
            address: "",
            gender: "",
            birthdate: "",
            role: "patient",
            createdAt: new Date().toISOString(),
            avatarUrl: "",
          };
          await setDoc(uRef, initial);
          setUserDoc(initial);
          setForm(initial);
        }
      } catch (e) {
        console.error("load profile err:", e);
        toast.error("Failed to load profile");
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const loadUserStats = async (userId) => {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Query appointments
      const apptQuery = query(
        collection(db, "appointments"),
        where("userId", "==", userId)
      );
      const apptSnap = await getDocs(apptQuery);

      // Query online requests
      const onlineQuery = query(
        collection(db, "onlineRequests"),
        where("userId", "==", userId)
      );
      const onlineSnap = await getDocs(onlineQuery);

      let total = 0;
      let upcoming = 0;
      let completed = 0;
      let lastVisitDate = null;

      const processAppointment = (data) => {
        total++;
        
        if (data.status === "treated") {
          completed++;
          const visitDate = new Date(data.date);
          if (!lastVisitDate || visitDate > lastVisitDate) {
            lastVisitDate = visitDate;
          }
        }
        
        if ((data.status === "confirmed" || data.status === "pending") && data.date >= today) {
          upcoming++;
        }
      };

      apptSnap.forEach(doc => processAppointment(doc.data()));
      onlineSnap.forEach(doc => processAppointment(doc.data()));

      setStats({
        totalAppointments: total,
        upcomingAppointments: upcoming,
        completedTreatments: completed,
        lastVisit: lastVisitDate ? lastVisitDate.toLocaleDateString() : "N/A"
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const loadRecentActivity = async (userId) => {
    try {
      setLoadingActivity(true);

      // Get recent appointments
      const apptQuery = query(
        collection(db, "appointments"),
        where("userId", "==", userId),
        orderBy("createdAt", "desc"),
        limit(5)
      );

      const onlineQuery = query(
        collection(db, "onlineRequests"),
        where("userId", "==", userId),
        orderBy("createdAt", "desc"),
        limit(5)
      );

      const [apptSnap, onlineSnap] = await Promise.all([
        getDocs(apptQuery),
        getDocs(onlineQuery)
      ]);

      const activities = [];

      apptSnap.forEach(doc => {
        const data = doc.data();
        activities.push({
          id: doc.id,
          type: data.status === "treated" ? "treatment" : "appointment",
          title: data.treatment || "Appointment",
          date: data.date,
          status: data.status,
          timestamp: data.createdAt
        });
      });

      onlineSnap.forEach(doc => {
        const data = doc.data();
        activities.push({
          id: doc.id,
          type: data.status === "treated" ? "treatment" : "appointment",
          title: data.treatment || "Appointment",
          date: data.date,
          status: data.status,
          timestamp: data.createdAt
        });
      });

      // Sort by timestamp
      activities.sort((a, b) => {
        const timeA = a.timestamp?.toMillis?.() || 0;
        const timeB = b.timestamp?.toMillis?.() || 0;
        return timeB - timeA;
      });

      setRecentActivity(activities.slice(0, 5));
    } catch (error) {
      console.error("Error loading activity:", error);
    } finally {
      setLoadingActivity(false);
    }
  };

  const setField = (patch) => setForm((f) => ({ ...f, ...patch }));

  const handleAvatarSelect = async (ev) => {
    const file = ev.target.files?.[0];
    if (!file || !user) return;
    
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (jpg/png).");
      return;
    }
    
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image too large (max 2MB).");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result;
      setPreviewImage(base64String);
      setField({ avatarUrl: base64String });
      toast.success("Image loaded. Click 'Save Changes' to update.");
    };
    reader.onerror = () => {
      toast.error("Failed to read image file");
    };
    reader.readAsDataURL(file);
    
    ev.target.value = "";
  };

  const handleRemoveAvatar = () => {
    setPreviewImage("");
    setField({ avatarUrl: "" });
    toast.info("Avatar will be removed when you save changes.");
  };

  const handleSave = async (ev) => {
    ev.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        contactNumber: form.contactNumber.trim(),
        address: form.address.trim(),
        gender: form.gender,
        birthdate: form.birthdate,
        avatarUrl: form.avatarUrl,
        updatedAt: serverTimestamp(),
      };

      const emailChanged =
        form.email && form.email !== (user.email || userDoc?.email);
      if (emailChanged) {
        if (!emailReauthPassword) {
          toast.error("Enter your password to update email");
          setSaving(false);
          return;
        }
        try {
          const cred = EmailAuthProvider.credential(
            user.email,
            emailReauthPassword
          );
          await reauthenticateWithCredential(user, cred);
          await updateEmail(user, form.email);
          payload.email = form.email;
          toast.success("Email updated");
          setEmailEditing(false);
          setEmailReauthPassword("");
        } catch (err) {
          toast.error("Failed to update email: " + err.message);
          setSaving(false);
          return;
        }
      }

      await updateDoc(doc(db, "users", user.uid), payload);
      setUserDoc((d) => ({ ...(d || {}), ...payload }));
      toast.success("Profile saved successfully!");
      setEditing(false);
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!curPassword || !newPassword || !confirmNewPassword) {
      toast.error("Fill all password fields");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setPwBusy(true);
    try {
      const cred = EmailAuthProvider.credential(user.email, curPassword);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, newPassword);
      toast.success("Password changed successfully!");
      setPwModal(false);
      setCurPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err) {
      toast.error("Failed to change password: " + err.message);
    } finally {
      setPwBusy(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      confirmed: { color: "bg-green-50 text-green-700 border-green-300", label: "Confirmed" },
      pending: { color: "bg-yellow-50 text-yellow-700 border-yellow-300", label: "Pending" },
      treated: { color: "bg-blue-50 text-blue-700 border-blue-300", label: "Completed" },
      cancelled: { color: "bg-red-50 text-red-700 border-red-300", label: "Cancelled" },
    };

    const config = statusConfig[status] || statusConfig.pending;

    return (
      <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${config.color}`}>
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded border-2 border-gray-400 text-center max-w-md w-full">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Profile Access</h2>
          <p className="text-gray-600 text-sm mb-6">Please sign in to view your profile.</p>
          <button
            onClick={() => navigate("/")}
            className="w-full px-6 py-2.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <ToastContainer position="top-right" autoClose={3000} />
      
      <div className="max-w-[1400px] mx-auto">

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left Column - Profile Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded border border-gray-300 p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-300">
                <h2 className="font-bold text-gray-800">Personal Information</h2>
                <button
                  onClick={() => {
                    setEditing(!editing);
                    if (editing) {
                      setPreviewImage(userDoc?.avatarUrl || "");
                      setForm(prev => ({ ...prev, avatarUrl: userDoc?.avatarUrl || "" }));
                    }
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-all ${
                    editing
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : "bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200"
                  }`}
                >
                  {editing ? <X className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                  {editing ? "Cancel" : "Edit Profile"}
                </button>
              </div>

              <form onSubmit={handleSave}>
                {/* Avatar Section */}
                <div className="flex items-center gap-4 mb-6 pb-4 border-b border-gray-200">
                  <div className="relative">
                    {previewImage ? (
                      <img
                        src={previewImage}
                        alt="Profile"
                        className="w-20 h-20 rounded-full object-cover border-2 border-gray-300"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-2xl font-bold text-white border-2 border-gray-300">
                        {(form.firstName || form.lastName || "P").charAt(0).toUpperCase()}
                      </div>
                    )}
                    {editing && (
                      <button
                        type="button"
                        onClick={() => fileRef.current.click()}
                        className="absolute bottom-0 right-0 bg-blue-600 text-white p-1.5 rounded-full hover:bg-blue-700 transition-all"
                      >
                        <Camera className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  
                  <input
                    type="file"
                    ref={fileRef}
                    accept="image/*"
                    onChange={handleAvatarSelect}
                    className="hidden"
                  />
                  
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800">
                      {form.firstName} {form.lastName}
                    </h3>
                    <p className="text-xs text-gray-600">{form.email}</p>
                    {editing && previewImage && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        className="flex items-center gap-1 mt-2 text-xs text-red-600 hover:text-red-700 font-medium"
                      >
                        <Trash2 className="w-3 h-3" />
                        Remove Photo
                      </button>
                    )}
                  </div>
                </div>

                {/* Form Fields */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        First Name
                      </label>
                      <input
                        value={form.firstName}
                        onChange={(e) => setField({ firstName: e.target.value })}
                        disabled={!editing}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-600 transition-all"
                        placeholder="First name"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Last Name
                      </label>
                      <input
                        value={form.lastName}
                        onChange={(e) => setField({ lastName: e.target.value })}
                        disabled={!editing}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-600 transition-all"
                        placeholder="Last name"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setField({ email: e.target.value })}
                      disabled={!emailEditing}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-600 transition-all"
                      placeholder="Email address"
                    />
                    {emailEditing && (
                      <input
                        type="password"
                        placeholder="Enter current password to change email"
                        value={emailReauthPassword}
                        onChange={(e) => setEmailReauthPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent mt-2"
                      />
                    )}
                    {editing && (
                      <button
                        type="button"
                        onClick={() => setEmailEditing(!emailEditing)}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-1"
                      >
                        {emailEditing ? "Cancel Email Change" : "Change Email"}
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      Contact Number
                    </label>
                    <input
                      type="tel"
                      value={form.contactNumber}
                      onChange={(e) => setField({ contactNumber: e.target.value })}
                      disabled={!editing}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-600 transition-all"
                      placeholder="Contact number"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      Address
                    </label>
                    <input
                      value={form.address}
                      onChange={(e) => setField({ address: e.target.value })}
                      disabled={!editing}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-600 transition-all"
                      placeholder="Complete address"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                        <CalendarIcon className="w-3 h-3" />
                        Birthdate
                      </label>
                      <input
                        type="date"
                        value={form.birthdate || ""}
                        onChange={(e) => setField({ birthdate: e.target.value })}
                        disabled={!editing}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-600 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Gender
                      </label>
                      <select
                        value={form.gender || ""}
                        onChange={(e) => setField({ gender: e.target.value })}
                        disabled={!editing}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-600 transition-all"
                      >
                        <option value="">Select Gender</option>
                        <option value="female">Female</option>
                        <option value="male">Male</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Save Button */}
                {editing && (
                  <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-300">
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium text-sm"
                    >
                      {saving ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Save Changes
                        </>
                      )}
                    </button>
                  </div>
                )}
              </form>
            </div>

            {/* Security Section */}
            <div className="bg-white rounded border border-gray-300 p-4 mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-gray-600" />
                    Security
                  </h3>
                  <p className="text-xs text-gray-600 mt-1">Manage your password and security settings</p>
                </div>
                <button
                  onClick={() => setPwModal(true)}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-sm font-medium"
                >
                  Change Password
                </button>
              </div>
            </div>
          </div>

          {/* Right Column - Recent Activity */}
          
        </div>
      </div>

      {/* Password Change Modal */}
      {pwModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4 border-b pb-3">
                <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                  <Lock className="text-gray-600" size={20} />
                  Change Password
                </h3>
                <button
                  onClick={() => {
                    setPwModal(false);
                    setCurPassword("");
                    setNewPassword("");
                    setConfirmNewPassword("");
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Current Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={curPassword}
                    onChange={(e) => setCurPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min 8 characters)"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm New Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    required
                  />
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded p-3">
                  <p className="text-xs text-gray-700">
                    <strong>Password Requirements:</strong>
                  </p>
                  <ul className="text-xs text-gray-600 mt-1 ml-4 list-disc">
                    <li>At least 8 characters long</li>
                    <li>Passwords must match</li>
                  </ul>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setPwModal(false);
                      setCurPassword("");
                      setNewPassword("");
                      setConfirmNewPassword("");
                    }}
                    disabled={pwBusy}
                    className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors disabled:opacity-50 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={pwBusy}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm font-medium"
                  >
                    {pwBusy ? "Changing..." : "Change Password"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}