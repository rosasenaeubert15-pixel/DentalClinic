import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, Users, Eye, Trash2, Loader2, ChevronLeft, ChevronRight, Maximize2, Minimize2, X } from 'lucide-react';
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy
} from 'firebase/firestore';
import { db } from '../../../firebase.config';

export default function AI() {
  const iframeRef = useRef(null);
  const iframeContainerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState('');
  const [selectedPatientName, setSelectedPatientName] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const patientDropdownRef = useRef(null);

  // Progress images
  const [progressImages, setProgressImages] = useState([]);
  const [progressFile, setProgressFile] = useState(null);
  const [progressPreview, setProgressPreview] = useState('');
  const [uploadingProgress, setUploadingProgress] = useState(false);

  // Goal/Result images
  const [goalImages, setGoalImages] = useState([]);
  const [goalFile, setGoalFile] = useState(null);
  const [goalPreview, setGoalPreview] = useState('');
  const [uploadingGoal, setUploadingGoal] = useState(false);

  // Timeline carousel
  const [showTimeline, setShowTimeline] = useState(false);
  const [timelineIndex, setTimelineIndex] = useState(0);

  useEffect(() => {
    setTimelineIndex(0);
  }, [progressImages, goalImages, selectedPatient]);

  // Viewing modal for enlarged images
  const [viewingImage, setViewingImage] = useState(null);

  const url = "http://smile.design/app/stable/v02/ai3/";
  const handleLoad = useCallback(() => setLoading(false), []);

  // Fullscreen handlers
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      iframeContainerRef.current?.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  }, []);

  // Listen for fullscreen changes (e.g., user pressing ESC)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (patientDropdownRef.current && !patientDropdownRef.current.contains(e.target)) {
        setShowPatientDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Combine progress (oldest->newest) and goal (newest->oldest) for the timeline
  const sortedProgress = [...progressImages].sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));
  const sortedGoal = [...goalImages].sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
  const timelineImages = [
    ...sortedProgress.map(img => ({ ...img, type: 'Progress' })),
    ...sortedGoal.map(img => ({ ...img, type: 'Goal' }))
  ];

  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });

  // Load patients
  useEffect(() => {
    async function loadPatients() {
      try {
        const snap = await getDocs(collection(db, 'users'));
        const list = [];
        snap.forEach((d) => {
          const data = d.data();
          // Only include users with role 'patient'
          if (data?.role === 'patient') {
            const name =
              data?.name ||
              `${data?.firstName || ''} ${data?.lastName || ''}`.trim() ||
              'Unnamed Patient';
            list.push({ id: d.id, name, email: data?.email || '' });
          }
        });
        if (list.length > 0) {
          setPatients(list);
          return;
        }
        const snap2 = await getDocs(collection(db, 'patients'));
        const list2 = [];
        snap2.forEach((d) => {
          const data = d.data();
          const name =
            data?.name ||
            `${data?.firstName || ''} ${data?.lastName || ''}`.trim() ||
            'Unnamed Patient';
          list2.push({ id: d.id, name, email: data?.email || '' });
        });
        setPatients(list2);
      } catch (err) {
        console.error('[AI] loadPatients error:', err);
      }
    }
    loadPatients();
  }, []);

  // Load images when patient selected
  useEffect(() => {
    if (!selectedPatient) {
      setProgressImages([]);
      setGoalImages([]);
      return;
    }
    async function loadImages() {
      try {
        // Load progress images
        const progressRef = collection(db, 'users', selectedPatient, 'aiProgress');
        const qProgress = query(progressRef, orderBy('timestamp', 'desc'));
        const snapProgress = await getDocs(qProgress);
        const progress = snapProgress.docs.map((d) => ({ id: d.id, ...d.data() }));
        setProgressImages(progress);

        // Load goal images
        const goalRef = collection(db, 'users', selectedPatient, 'aiGoals');
        const qGoal = query(goalRef, orderBy('timestamp', 'desc'));
        const snapGoal = await getDocs(qGoal);
        const goals = snapGoal.docs.map((d) => ({ id: d.id, ...d.data() }));
        setGoalImages(goals);
      } catch (err) {
        console.warn('[AI] Error loading from users, trying patients:', err);
        try {
          const progressRef = collection(db, 'patients', selectedPatient, 'aiProgress');
          const qProgress = query(progressRef, orderBy('timestamp', 'desc'));
          const snapProgress = await getDocs(qProgress);
          const progress = snapProgress.docs.map((d) => ({ id: d.id, ...d.data() }));
          setProgressImages(progress);

          const goalRef = collection(db, 'patients', selectedPatient, 'aiGoals');
          const qGoal = query(goalRef, orderBy('timestamp', 'desc'));
          const snapGoal = await getDocs(qGoal);
          const goals = snapGoal.docs.map((d) => ({ id: d.id, ...d.data() }));
          setGoalImages(goals);
        } catch (err2) {
          console.error('[AI] loadImages error:', err2);
        }
      }
    }
    loadImages();
  }, [selectedPatient]);

  // Upload Progress
  const handleUploadProgress = async () => {
    if (!selectedPatient) {
      alert('Please select a patient first');
      return;
    }
    if (!progressFile) {
      alert('Please select an image file');
      return;
    }
    setUploadingProgress(true);
    try {
      const base64Image = await fileToBase64(progressFile);
      const docData = { imageUrl: base64Image, timestamp: serverTimestamp() };
      try {
        await addDoc(collection(db, 'users', selectedPatient, 'aiProgress'), docData);
      } catch (err) {
        await addDoc(collection(db, 'patients', selectedPatient, 'aiProgress'), docData);
      }
      // Reload images
      const progressRef = collection(db, 'users', selectedPatient, 'aiProgress');
      const q = query(progressRef, orderBy('timestamp', 'desc'));
      const snap = await getDocs(q);
      setProgressImages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setProgressFile(null);
      setProgressPreview('');
      alert('Progress image uploaded successfully!');
    } catch (err) {
      console.error('[AI] Upload progress error:', err);
      alert('Upload failed: ' + err.message);
    } finally {
      setUploadingProgress(false);
    }
  };

  // Upload Goal
  const handleUploadGoal = async () => {
    if (!selectedPatient) {
      alert('Please select a patient first');
      return;
    }
    if (!goalFile) {
      alert('Please select an image file');
      return;
    }
    setUploadingGoal(true);
    try {
      const base64Image = await fileToBase64(goalFile);
      const docData = { imageUrl: base64Image, timestamp: serverTimestamp() };
      try {
        await addDoc(collection(db, 'users', selectedPatient, 'aiGoals'), docData);
      } catch (err) {
        await addDoc(collection(db, 'patients', selectedPatient, 'aiGoals'), docData);
      }
      // Reload images
      const goalRef = collection(db, 'users', selectedPatient, 'aiGoals');
      const q = query(goalRef, orderBy('timestamp', 'desc'));
      const snap = await getDocs(q);
      setGoalImages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setGoalFile(null);
      setGoalPreview('');
      alert('Goal image uploaded successfully!');
    } catch (err) {
      console.error('[AI] Upload goal error:', err);
      alert('Upload failed: ' + err.message);
    } finally {
      setUploadingGoal(false);
    }
  };

  // Delete image
  const handleDelete = async (imageId, type) => {
    if (!window.confirm('Delete this image?')) return;
    try {
      const collectionName = type === 'Progress' ? 'aiProgress' : 'aiGoals';
      try {
        await deleteDoc(doc(db, 'users', selectedPatient, collectionName, imageId));
      } catch (err) {
        await deleteDoc(doc(db, 'patients', selectedPatient, collectionName, imageId));
      }
      // Reload
      if (collectionName === 'aiProgress') {
        setProgressImages(prev => prev.filter(img => img.id !== imageId));
      } else {
        setGoalImages(prev => prev.filter(img => img.id !== imageId));
      }
    } catch (err) {
      console.error('[AI] Delete error:', err);
      alert('Delete failed');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-[1400px] mx-auto">
        {/* Header 
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-800">DentaVis AI</h1>
          <p className="text-sm text-gray-600">AI-Powered Smile Design & Progress Tracking</p>
        </div>*/}

        {/* Main Grid - Two Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          
          {/* LEFT COLUMN - AI Iframe (2/3 width) */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded border border-gray-300 overflow-hidden relative" ref={iframeContainerRef}>
              {loading && (
                <div className="flex items-center justify-center h-[500px] bg-gray-50">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-600" />
                  <span className="ml-2 text-sm text-gray-600">Loading AI Designer...</span>
                </div>
              )}
              <iframe
                ref={iframeRef}
                src={url}
                onLoad={handleLoad}
                title="AI Smile Design"
                sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-downloads"
                className={isFullscreen ? "w-full h-screen border-0" : "w-full h-[500px] border-0"}
              />
              <button
                onClick={toggleFullscreen}
                className="absolute top-3 right-3 bg-white hover:bg-gray-100 text-gray-700 p-2 rounded shadow-md transition-all z-10 border border-gray-300"
                title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN - Controls (1/3 width) */}
          <div className="space-y-4">
            
            {/* Patient Selection Box with Search */}
            <div className="bg-white rounded border border-gray-300 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-gray-600" />
                <label className="text-sm font-semibold text-gray-700">Select Patient</label>
              </div>
              
              {/* Search Dropdown */}
              <div className="relative" ref={patientDropdownRef}>
                <input
                  type="text"
                  placeholder="Search patient name or email..."
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  onFocus={() => setShowPatientDropdown(true)}
                  className="w-full px-3 py-2 border border-gray-400 rounded text-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600 bg-white"
                />
                
                {/* Selected Patient Display */}
                {selectedPatient && (
                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-gray-700">
                    <span className="font-medium">Selected:</span> {selectedPatientName}
                  </div>
                )}
                
                {/* Dropdown Results */}
                {showPatientDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg">
                    {(() => {
                      const filtered = patients.filter(p =>
                        p.name.toLowerCase().includes(patientSearch.toLowerCase()) ||
                        p.email.toLowerCase().includes(patientSearch.toLowerCase())
                      );
                      
                      return filtered.length > 0 ? (
                        <ul className="max-h-48 overflow-y-auto">
                          {filtered.map((p) => (
                            <li
                              key={p.id}
                              onClick={() => {
                                setSelectedPatient(p.id);
                                setSelectedPatientName(p.name);
                                setPatientSearch('');
                                setShowPatientDropdown(false);
                              }}
                              className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b last:border-b-0"
                            >
                              <div className="font-medium text-sm text-gray-800">{p.name}</div>
                              <div className="text-xs text-gray-500">{p.email}</div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="px-3 py-3 text-sm text-gray-500 text-center">
                          No patients found
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>

            {/* Upload Progress Box */}
            <div className="bg-white rounded border border-gray-300 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                <h3 className="text-sm font-semibold text-gray-700">Upload Progress</h3>
              </div>
              {!progressPreview ? (
                <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-300 rounded cursor-pointer bg-gray-50 hover:bg-gray-100 transition">
                  <Upload className="w-6 h-6 text-gray-400 mb-1" />
                  <span className="text-xs text-gray-500">Click to upload</span>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      if (!f.type.startsWith("image/")) {
                        alert("Please select an image file (jpg/png)");
                        return;
                      }
                      if (f.size > 5 * 1024 * 1024) {
                        alert("Image too large (max 5MB)");
                        return;
                      }
                      setProgressFile(f);
                      setProgressPreview(URL.createObjectURL(f));
                    }}
                  />
                </label>
              ) : (
                <div className="space-y-2">
                  <img src={progressPreview} alt="Preview" className="w-full h-28 object-cover rounded border border-gray-300" />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setProgressFile(null);
                        setProgressPreview('');
                      }}
                      className="flex-1 bg-gray-500 text-white py-1.5 rounded text-xs font-medium hover:bg-gray-600 transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUploadProgress}
                      disabled={uploadingProgress}
                      className="flex-1 bg-blue-600 text-white py-1.5 rounded text-xs font-medium hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      {uploadingProgress ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      Upload
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Upload Goal Box */}
            <div className="bg-white rounded border border-gray-300 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                <h3 className="text-sm font-semibold text-gray-700">Upload Goal/Result</h3>
              </div>
              {!goalPreview ? (
                <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-300 rounded cursor-pointer bg-gray-50 hover:bg-gray-100 transition">
                  <Upload className="w-6 h-6 text-gray-400 mb-1" />
                  <span className="text-xs text-gray-500">Click to upload</span>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      if (!f.type.startsWith("image/")) {
                        alert("Please select an image file (jpg/png)");
                        return;
                      }
                      if (f.size > 5 * 1024 * 1024) {
                        alert("Image too large (max 5MB)");
                        return;
                      }
                      setGoalFile(f);
                      setGoalPreview(URL.createObjectURL(f));
                    }}
                  />
                </label>
              ) : (
                <div className="space-y-2">
                  <img src={goalPreview} alt="Preview" className="w-full h-28 object-cover rounded border border-gray-300" />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setGoalFile(null);
                        setGoalPreview('');
                      }}
                      className="flex-1 bg-gray-500 text-white py-1.5 rounded text-xs font-medium hover:bg-gray-600 transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUploadGoal}
                      disabled={uploadingGoal}
                      className="flex-1 bg-green-600 text-white py-1.5 rounded text-xs font-medium hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      {uploadingGoal ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      Upload
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Timeline Section - Only shows when patient is selected */}
        {selectedPatient && (
          <div className="mt-4 bg-white rounded border border-gray-300 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-semibold text-gray-800">
                  {selectedPatientName}'s Progress Timeline
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {timelineImages.length} image{timelineImages.length !== 1 ? 's' : ''} total
                </p>
              </div>
              {timelineImages.length > 0 && (
                <button
                  onClick={() => setShowTimeline(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition text-sm font-medium"
                >
                  View Timeline
                </button>
              )}
            </div>
            
            {timelineImages.length === 0 ? (
              <div className="w-full h-32 flex items-center justify-center bg-gray-50 rounded border-2 border-dashed border-gray-300">
                <p className="text-sm text-gray-400">No images uploaded yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {timelineImages.slice(0, 6).map((img, idx) => (
                  <div 
                    key={img.id}
                    className="relative group cursor-pointer"
                    onClick={() => {
                      setTimelineIndex(idx);
                      setShowTimeline(true);
                    }}
                  >
                    <img 
                      src={img.imageUrl} 
                      alt={`${img.type} ${idx + 1}`}
                      className="w-full h-20 object-cover rounded border border-gray-300 group-hover:border-blue-500 transition"
                    />
                    <div className="absolute top-1 right-1">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                        img.type === 'Progress' ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'
                      }`}>
                        {img.type === 'Progress' ? 'P' : 'G'}
                      </span>
                    </div>
                  </div>
                ))}
                {timelineImages.length > 6 && (
                  <div 
                    className="w-full h-20 flex items-center justify-center bg-gray-100 rounded border border-gray-300 cursor-pointer hover:bg-gray-200 transition"
                    onClick={() => setShowTimeline(true)}
                  >
                    <span className="text-xs text-gray-600 font-medium">+{timelineImages.length - 6}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Timeline Modal - Simplified and cleaner */}
      {showTimeline && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setShowTimeline(false)}
        >
          <div
            className="max-w-4xl w-full bg-white rounded border border-gray-400 p-6 relative"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-300">
              <h4 className="text-lg font-semibold text-gray-700">Progress Timeline</h4>
              <button
                onClick={() => setShowTimeline(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {timelineImages.length < 1 ? (
              <div className="w-full h-64 flex items-center justify-center">
                <p className="text-gray-400">No images available</p>
              </div>
            ) : (
              <div>
                {/* Main Image Display */}
                <div className="flex items-center justify-center gap-4 mb-4">
                  {/* Previous thumbnail (blurred) */}
                  <div className="w-24 h-32 flex-shrink-0">
                    {timelineIndex > 0 && (
                      <img
                        src={timelineImages[timelineIndex - 1].imageUrl}
                        alt="Previous"
                        className="w-full h-full object-cover rounded opacity-50 blur-sm"
                      />
                    )}
                  </div>

                  {/* Current image (main focus) */}
                  <div className="relative flex-shrink-0">
                    <img
                      src={timelineImages[timelineIndex].imageUrl}
                      alt={`${timelineImages[timelineIndex].type} ${timelineIndex + 1}`}
                      className="w-80 h-96 object-cover rounded-lg shadow-lg border-2 border-gray-300"
                    />
                    {/* Type badge */}
                    <div className={`absolute top-3 right-3 text-xs px-2 py-1 rounded font-medium ${
                      timelineImages[timelineIndex].type === 'Progress'
                        ? 'bg-blue-600 text-white'
                        : 'bg-green-600 text-white'
                    }`}>
                      {timelineImages[timelineIndex].type}
                    </div>
                    {/* Counter */}
                    <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 px-3 py-1 rounded text-white text-xs">
                      {timelineIndex + 1} / {timelineImages.length}
                    </div>
                  </div>

                  {/* Next thumbnail (blurred) */}
                  <div className="w-24 h-32 flex-shrink-0">
                    {timelineIndex < timelineImages.length - 1 && (
                      <img
                        src={timelineImages[timelineIndex + 1].imageUrl}
                        alt="Next"
                        className="w-full h-full object-cover rounded opacity-50 blur-sm"
                      />
                    )}
                  </div>
                </div>

                {/* Date info */}
                {timelineImages[timelineIndex].timestamp && (
                  <div className="text-center text-xs text-gray-500 mb-3">
                    Uploaded: {new Date(timelineImages[timelineIndex].timestamp.seconds * 1000).toLocaleDateString()}
                  </div>
                )}

                {/* Controls */}
                <div className="flex gap-2 justify-center pt-3 border-t border-gray-300">
                  <button
                    onClick={() => setTimelineIndex(prev => prev - 1)}
                    className={`p-2 rounded bg-gray-100 hover:bg-gray-200 border border-gray-300 ${
                      timelineIndex === 0 ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    disabled={timelineIndex === 0}
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-600" />
                  </button>
                  <button
                    onClick={() => setTimelineIndex(prev => prev + 1)}
                    className={`p-2 rounded bg-gray-100 hover:bg-gray-200 border border-gray-300 ${
                      timelineIndex === timelineImages.length - 1 ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    disabled={timelineIndex === timelineImages.length - 1}
                  >
                    <ChevronRight className="w-5 h-5 text-gray-600" />
                  </button>
                  <button
                    onClick={() => setViewingImage(timelineImages[timelineIndex].imageUrl)}
                    className="p-2 rounded bg-white hover:bg-gray-50 border border-gray-300"
                  >
                    <Eye className="w-5 h-5 text-gray-700" />
                  </button>
                  <button
                    onClick={() => handleDelete(timelineImages[timelineIndex].id, timelineImages[timelineIndex].type)}
                    className="p-2 rounded bg-red-500 hover:bg-red-600 border border-red-600"
                  >
                    <Trash2 className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full Image View Modal */}
      {viewingImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
          onClick={() => setViewingImage(null)}
        >
          <div className="max-w-5xl max-h-[90vh] relative">
            <img src={viewingImage} alt="Full view" className="max-w-full max-h-[90vh] rounded" />
            <button
              onClick={() => setViewingImage(null)}
              className="absolute top-4 right-4 bg-white text-gray-700 p-2 rounded-full hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}