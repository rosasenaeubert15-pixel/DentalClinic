import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, setDoc, updateDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../firebase.config";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useNavigate } from "react-router-dom";
import {
  X as IconX,
  Calendar,
  Shield,
  Users,
} from "lucide-react";
import loginImg from "../assets/login.jpg";

// ============ TERMS AND CONDITIONS MODAL ============
function TermsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-2xl font-bold text-blue-900">Privacy Policy and Terms & Conditions</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition"
            aria-label="Close"
          >
            <IconX size={24} className="text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 overflow-y-auto max-h-[calc(85vh-80px)]">
          <div className="prose prose-sm max-w-none">
            <h2 className="text-xl font-bold text-blue-900 mb-2">Terms and Conditions</h2>
            <p className="text-gray-600 mb-4">By registering on the Abeledo Dental website, you agree to the following terms governing your access to dental services and management of your patient information.</p>
            <hr className="my-4" />
            <h4 className="text-lg font-semibold text-gray-900 mt-6 mb-2">1. Eligibility</h4>
            <ul className="list-disc pl-6 text-gray-600 mb-4">
              <li>Provide accurate and complete personal information during registration.</li>
              <li>Patients under 18 require parental or guardian consent.</li>
            </ul>
            <h4 className="text-lg font-semibold text-gray-900 mt-6 mb-2">2. Account Registration</h4>
            <ul className="list-disc pl-6 text-gray-600 mb-4">
              <li>Register only via the official Abeledo Dental website.</li>
              <li>Required details: name, contact number, email, and medical history.</li>
              <li>Confirmation will be sent to your registered email.</li>
            </ul>
            <h4 className="text-lg font-semibold text-gray-900 mt-6 mb-2">3. Communication</h4>
            <ul className="list-disc pl-6 text-gray-600 mb-4">
              <li>We may contact you for appointments, updates, and billing.</li>
              <li>Keep your contact information current.</li>
            </ul>
            <h4 className="text-lg font-semibold text-gray-900 mt-6 mb-2">4. Privacy & Data Protection</h4>
            <ul className="list-disc pl-6 text-gray-600 mb-4">
              <li>Your information is confidential and used only for dental care.</li>
              <li>We comply with data protection laws and clinic policies.</li>
              <li>See our <span className="underline">Privacy Policy</span> for details.</li>
            </ul>
            <h4 className="text-lg font-semibold text-gray-900 mt-6 mb-2">5. Appointments & Cancellations</h4>
            <ul className="list-disc pl-6 text-gray-600 mb-4">
              <li>Book, reschedule, or cancel via website or clinic.</li>
              <li>Notify us at least 24 hours before cancelling.</li>
            </ul>
            <h4 className="text-lg font-semibold text-gray-900 mt-6 mb-2">6. Billing & Payments</h4>
            <ul className="list-disc pl-6 text-gray-600 mb-4">
              <li>All treatment charges are your responsibility.</li>
              <li>Payment terms are discussed during your visit and must be settled as per clinic policy.</li>
            </ul>
            <h4 className="text-lg font-semibold text-gray-900 mt-6 mb-2">7. Changes to Terms</h4>
            <ul className="list-disc pl-6 text-gray-600 mb-4">
              <li>Terms may be updated. Continued use means acceptance of changes.</li>
            </ul>
            <h4 className="text-lg font-semibold text-gray-900 mt-6 mb-2">8. Account Termination</h4>
            <ul className="list-disc pl-6 text-gray-600 mb-4">
              <li>We may suspend or terminate accounts for misconduct, non-payment, or policy violations.</li>
            </ul>
            <hr className="my-6" />
            <h2 className="text-xl font-bold text-blue-900 mb-2">Privacy Policy</h2>
            <p className="text-gray-600 mb-4">Abeledo Dental is committed to protecting your privacy. This policy explains how we collect, use, and safeguard your data.</p>
            <h4 className="text-lg font-semibold text-gray-900 mt-6 mb-2">1. Information We Collect</h4>
            <ul className="list-disc pl-6 text-gray-600 mb-4">
              <li>Personal: Name, contact number, email, date of birth.</li>
              <li>Medical: Dental history, treatment records, health details.</li>
              <li>Account: Login credentials, appointment history.</li>
            </ul>
            <h4 className="text-lg font-semibold text-gray-900 mt-6 mb-2">2. Use of Information</h4>
            <ul className="list-disc pl-6 text-gray-600 mb-4">
              <li>Manage appointments and dental records.</li>
              <li>Communicate regarding your care.</li>
              <li>Support safe and effective treatment.</li>
            </ul>
            <h4 className="text-lg font-semibold text-gray-900 mt-6 mb-2">3. No Cookies or Tracking</h4>
            <ul className="list-disc pl-6 text-gray-600 mb-4">
              <li>We do not use cookies or tracking technologies.</li>
              <li>No browsing or behavioral data is collected.</li>
            </ul>
            <h4 className="text-lg font-semibold text-gray-900 mt-6 mb-2">4. No Data Sharing</h4>
            <ul className="list-disc pl-6 text-gray-600 mb-4">
              <li>Your data is not shared with third parties.</li>
              <li>Access is restricted to authorized clinic staff.</li>
            </ul>
            <h4 className="text-lg font-semibold text-gray-900 mt-6 mb-2">5. Data Security</h4>
            <ul className="list-disc pl-6 text-gray-600 mb-4">
              <li>We use security measures to protect your data from unauthorized access, alteration, or loss.</li>
            </ul>
            <h4 className="text-lg font-semibold text-gray-900 mt-6 mb-2">6. Your Rights</h4>
            <ul className="list-disc pl-6 text-gray-600 mb-4">
              <li>Access your data.</li>
              <li>Request corrections.</li>
              <li>Withdraw consent or request deletion (subject to legal/medical obligations).</li>
            </ul>
            <h4 className="text-lg font-semibold text-gray-900 mt-6 mb-2">7. Policy Updates</h4>
            <ul className="list-disc pl-6 text-gray-600 mb-4">
              <li>We may update this policy. Changes are posted on our website.</li>
            </ul>
          </div>
        </div>

        {/* Footer removed as requested */}
      </div>
    </div>
  );
}

// ============ LOGIN COMPONENT ============
function LoginForm({ 
  loginEmail, 
  setLoginEmail, 
  loginPassword, 
  setLoginPassword,
  loginShowPassword,
  setLoginShowPassword,
  loginLoading,
  handleLoginSubmit,
  switchTo,
  regFieldPrefix,
  firstInputRef
}) {
  return (
    <form onSubmit={handleLoginSubmit} className="space-y-5" autoComplete="off" noValidate>
      <div>
        <label className="text-base font-medium text-gray-700 mb-2 block">Email Address</label>
        <input
          ref={firstInputRef}
          value={loginEmail}
          onChange={(e) => setLoginEmail(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-900 outline-none text-base"
          placeholder="you@example.com"
          type="email"
          name={`loginEmail_${regFieldPrefix || "l"}`}
          autoComplete="off"
        />
      </div>

      <div>
        <label className="text-base font-medium text-gray-700 mb-2 flex justify-between items-center">
          <span>Password</span>
          <button type="button" onClick={() => setLoginShowPassword((s) => !s)} className="text-sm text-blue-900 hover:underline font-medium">
            {loginShowPassword ? "Hide" : "Show"}
          </button>
        </label>
        <input
          value={loginPassword}
          onChange={(e) => setLoginPassword(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-900 outline-none text-base"
          placeholder="••••••••"
          type={loginShowPassword ? "text" : "password"}
          name={`loginPassword_${regFieldPrefix || "lp"}`}
          autoComplete="off"
        />
      </div>

      <div className="flex justify-end items-center text-sm pt-1">
        <button type="button" onClick={() => switchTo("forgot")} className="text-blue-900 hover:underline font-medium">
          Forgot password?
        </button>
      </div>

      <div className="flex gap-3 pt-3">
        <button
          type="submit"
          disabled={loginLoading}
          className="flex-1 py-3.5 rounded-lg bg-gradient-to-r from-blue-900 to-blue-800 text-white font-semibold text-base shadow-lg hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loginLoading ? "Signing in..." : "Sign In"}
        </button>
        <button
          type="button"
          onClick={() => switchTo("register")}
          className="py-3.5 px-8 rounded-lg border-2 border-gray-300 font-semibold text-base hover:bg-gray-50 transition"
        >
          Register
        </button>
      </div>
    </form>
  );
}

// ============ REGISTER COMPONENT ============
function RegisterForm({
  regFirstName,
  setRegFirstName,
  regLastName,
  setRegLastName,
  regEmail,
  setRegEmail,
  regContact,
  handleRegContactChange,
  regAddress,
  setRegAddress,
  regPassword,
  setRegPassword,
  regConfirm,
  setRegConfirm,
  regShowPassword,
  setRegShowPassword,
  agreeTerms,
  setAgreeTerms,
  regLoading,
  handleRegisterSubmit,
  switchTo,
  regFieldPrefix,
  firstInputRef,
  regChecks,
  regScore,
  regScoreInfo,
  regProgress,
  onOpenTerms
}) {
  return (
    <form
      onSubmit={handleRegisterSubmit}
      className="space-y-4"
      autoComplete="off"
      noValidate
      key={`register-form-${regFieldPrefix}`}
    >
      {/* Hidden dummy fields to trap browser autofill */}
      <div style={{ position: "absolute", left: "-9999px", top: "-9999px", opacity: 0, height: 0, width: 0 }}>
        <input type="text" name={`fake_user_${regFieldPrefix}`} autoComplete="username" />
        <input type="password" name={`fake_pass_${regFieldPrefix}`} autoComplete="new-password" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="text-base font-medium text-gray-700 mb-2 block">First Name</label>
          <input
            ref={firstInputRef}
            value={regFirstName}
            onChange={(e) => setRegFirstName(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-900 outline-none text-base"
           
            type="text"
            name={`regFirstName_${regFieldPrefix}`}
            autoComplete="off"
          />
        </div>
        <div>
          <label className="text-base font-medium text-gray-700 mb-2 block">Last Name</label>
          <input
            value={regLastName}
            onChange={(e) => setRegLastName(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-900 outline-none text-base"
           
            type="text"
            name={`regLastName_${regFieldPrefix}`}
            autoComplete="off"
          />
        </div>
      </div>

      <div>
        <label className="text-base font-medium text-gray-700 mb-2 block">Email Address</label>
        <input
          value={regEmail}
          onChange={(e) => setRegEmail(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-200 focus:border-cyan-500 outline-none text-base"
          placeholder="you@example.com"
          type="email"
          name={`regEmail_${regFieldPrefix}`}
          autoComplete="off"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="text-base font-medium text-gray-700 mb-2 block">Contact Number</label>
          <div className="flex items-stretch">
            <span className="inline-flex items-center px-4 rounded-l-lg bg-gray-100 border border-r-0 border-gray-300 text-gray-700 text-base font-medium">
              +63
            </span>
            <input
              value={regContact}
              onChange={handleRegContactChange}
              className="w-40 px-4 py-3 border border-gray-300 rounded-r-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-900 outline-none text-base"
              placeholder="9123456789"
              inputMode="numeric"
              maxLength={10}
              name={`regContact_${regFieldPrefix}`}
              autoComplete="off"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1.5">Enter 10 digits (e.g. <span className="font-medium">9123456789</span>)</p>
        </div>
        <div>
          <label className="text-base font-medium text-gray-700 mb-2 block">Address</label>
          <input
            value={regAddress}
            onChange={(e) => setRegAddress(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-900 outline-none text-base"
            placeholder="Street, City"
            type="text"
            name={`regAddress_${regFieldPrefix}`}
            autoComplete="off"
          />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="text-base font-medium text-gray-700 mb-2 flex justify-between items-center">
            <span>Password</span>
            <button type="button" onClick={() => setRegShowPassword((s) => !s)} className="text-sm text-cyan-600 hover:underline font-medium">
              {regShowPassword ? "Hide" : "Show"}
            </button>
          </label>
          <input
            value={regPassword}
            onChange={(e) => setRegPassword(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-900 outline-none text-base"
            placeholder="Choose a password"
            type={regShowPassword ? "text" : "password"}
            name={`regPassword_${regFieldPrefix}`}
            autoComplete="new-password"
          />
        </div>

        <div>
          <label className="text-base font-medium text-gray-700 mb-2 block">Confirm Password</label>
          <input
            value={regConfirm}
            onChange={(e) => setRegConfirm(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-200 focus:border-cyan-500 outline-none text-base"
            placeholder="Repeat password"
            type={regShowPassword ? "text" : "password"}
            name={`regConfirm_${regFieldPrefix}`}
            autoComplete="new-password"
          />
        </div>
      </div>

      <div className="mt-3">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-700 font-medium">Password Strength</span>
          <span className={`font-semibold ${regScoreInfo.color}`}>{regScoreInfo.text}</span>
        </div>
        <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
          <div className={`${regScoreInfo.bar} h-full rounded-full transition-all duration-300`} style={{ width: `${regProgress}%` }} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          {[
            { key: "length", label: "8+ characters" },
            { key: "upper", label: "Uppercase" },
            { key: "lower", label: "Lowercase" },
            { key: "number", label: "Numbers" },
            { key: "special", label: "Symbols" },
          ].map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded-full flex-shrink-0 ${regChecks[item.key] ? "bg-blue-900" : "bg-gray-300"}`} />
              <span className={regChecks[item.key] ? "text-gray-700" : "text-gray-400"}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <label className="flex items-start gap-3 pt-3">
        <input
          type="checkbox"
          checked={agreeTerms}
          onChange={(e) => setAgreeTerms(e.target.checked)}
          className="w-5 h-5 rounded border-gray-300 mt-0.5 flex-shrink-0 cursor-pointer"
          name={`agreeTerms_${regFieldPrefix}`}
          autoComplete="off"
        />
        <div className="text-sm text-gray-600 leading-relaxed">
          I agree to the{" "}
          <button 
            type="button" 
            onClick={onOpenTerms}
            className="text-blue-900 hover:underline font-medium"
          >
            Privacy Policy and Terms & Conditions
          </button>
        </div>
      </label>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={regLoading}
          className="flex-1 py-3.5 rounded-lg bg-gradient-to-r from-blue-900 to-blue-800 text-white font-semibold text-base shadow-lg hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {regLoading ? "Creating Account..." : "Create Account"}
        </button>
        <button
          type="button"
          onClick={() => switchTo("login")}
          className="py-3.5 px-8 rounded-lg border-2 border-gray-300 font-semibold text-base hover:bg-gray-50 transition"
        >
          Sign In
        </button>
      </div>
    </form>
  );
}

// ============ FORGOT PASSWORD COMPONENT ============
function ForgotPasswordForm({ forgotEmail, setForgotEmail, handleForgotSubmit, switchTo, firstInputRef }) {
  return (
    <form onSubmit={handleForgotSubmit} className="space-y-5">
      <div>
        <label className="text-base font-medium text-gray-700 mb-2 block">Email Address</label>
        <input
          ref={firstInputRef}
          value={forgotEmail}
          onChange={(e) => setForgotEmail(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-900 outline-none text-base"
          placeholder="you@example.com"
          type="email"
        />
      </div>

      <div className="flex gap-3 pt-3">
        <button
          type="submit"
          className="flex-1 py-3.5 rounded-lg bg-gradient-to-r from-blue-900 to-blue-800 text-white font-semibold text-base shadow-lg hover:shadow-xl hover:scale-105 transition-all"
        >
          Send Reset Link
        </button>
        <button
          type="button"
          onClick={() => switchTo("login")}
          className="py-3.5 px-8 rounded-lg border-2 border-gray-300 font-semibold text-base hover:bg-gray-50 transition"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ============ MAIN AUTH COMPONENT ============
export default function AuthModal() {
  const navigate = useNavigate();

  const ROUTE_MAP = {
    patient: "/patient",
    admin: "/admin",
    staff: "/staff",
    dentist: "/dentist",
  };

  // UI state
  const [view, setView] = useState("login");
  const [message, setMessage] = useState(null);

  const modalRef = useRef(null);
  const firstInputRef = useRef(null);

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginShowPassword, setLoginShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  // Register state
  const [regFirstName, setRegFirstName] = useState("");
  const [regLastName, setRegLastName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regContact, setRegContact] = useState("");
  const [regAddress, setRegAddress] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [regShowPassword, setRegShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [regLoading, setRegLoading] = useState(false);

  const [regFieldPrefix, setRegFieldPrefix] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [isTermsOpen, setIsTermsOpen] = useState(false);

  useEffect(() => {
    setTimeout(() => firstInputRef.current?.focus(), 60);
  }, [view]);

  const generatePrefix = () =>
    Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

  useEffect(() => {
    if (view === "register") {
      setRegFieldPrefix(generatePrefix());
      setRegFirstName("");
      setRegLastName("");
      setRegEmail("");
      setRegContact("");
      setRegAddress("");
      setRegPassword("");
      setRegConfirm("");
      setAgreeTerms(false);
    }
  }, [view]);

  // Helpers
  const isValidEmail = (e) =>
    typeof e === "string" && e.length > 5 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

  const extractFirebaseError = (err) => {
    if (!err) return "Unknown error";
    if (err?.message) return err.message;
    if (err?.code) return err.code;
    return String(err);
  };

  const safeUpdateDoc = async (ref, data) => {
    try {
      await updateDoc(ref, data);
    } catch (e) {
      try {
        await setDoc(ref, data, { merge: true });
      } catch (ee) {
        console.warn("safeUpdateDoc fallback failed:", ee);
      }
    }
  };

  const showMsg = (type, text) => {
    setMessage({ type, text });
    if (type === "success") toast.success(text);
    else if (type === "error") toast.error(text);
    else toast.info(text);
  };

  // Password helpers
  function passwordChecks(password = "") {
    return {
      length: password.length >= 8,
      upper: /[A-Z]/.test(password),
      lower: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>_\-\[\]=+;\/~`]/.test(password),
    };
  }
  function passwordScore(checks) {
    return ["length", "upper", "lower", "number", "special"].reduce((s, k) => s + (checks[k] ? 1 : 0), 0);
  }
  function scoreLabel(score) {
    if (score <= 2) return { text: "Weak", color: "text-rose-600", bar: "bg-rose-500" };
    if (score === 3) return { text: "Medium", color: "text-amber-600", bar: "bg-amber-500" };
    return { text: "Strong", color: "text-blue-900", bar: "bg-blue-900" };
  }

  const regChecks = passwordChecks(regPassword);
  const regScore = passwordScore(regChecks);
  const regScoreInfo = scoreLabel(regScore);
  const regProgress = Math.round((regScore / 5) * 100);

  // LOGIN
  const handleLoginSubmit = useCallback(
    async (ev) => {
      ev?.preventDefault();
      setMessage(null);

      if (!isValidEmail(loginEmail)) return showMsg("error", "Enter a valid email.");
      if (!loginPassword) return showMsg("error", "Enter your password.");

      setLoginLoading(true);
      try {
        const normalizedEmail = loginEmail.trim().toLowerCase();
        const cred = await signInWithEmailAndPassword(auth, normalizedEmail, loginPassword);
        const user = cred.user;
        if (!user) throw new Error("No user returned");

        await user.reload();

        const userDocRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userDocRef);

        if (!userSnap.exists()) {
          await signOut(auth);
          showMsg("error", "We could not find an account associated with this email address. If you believe this is a mistake, please contact our support team.");
          setLoginLoading(false);
          return;
        }

        const userData = userSnap.data();
        const userRole = userData.role || "patient";
        const userStatus = userData.status || "Active";

        // Check if account is inactive
        if (userStatus === "Inactive" || userStatus === "inactive") {
          await signOut(auth);
          showMsg("error", "Your account is currently inactive. Please visit the clinic or contact support to reactivate your account.");
          setLoginLoading(false);
          return;
        }

        if (userRole === "patient" && !user.emailVerified) {
          await signOut(auth);
          showMsg("error", "Your email address has not been verified. Please check your inbox and spam folder for the verification link before logging in.");
          setLoginLoading(false);
          return;
        }

        if (user.emailVerified && !userData.emailVerified) {
          try {
            await safeUpdateDoc(userDocRef, { emailVerified: true });
          } catch (e) {
            console.warn("safeUpdateDoc error:", e);
          }
        }

        localStorage.setItem("role", userRole);
        localStorage.setItem("uid", user.uid);

        toast.success(`Welcome back, ${userData.firstName || userRole}!`);

        setTimeout(() => {
          navigate(ROUTE_MAP[userRole] || "/");
        }, 300);
      } catch (err) {
        console.error("Login error:", err);
        if (err?.code === "auth/user-not-found") showMsg("error", "We could not find an account with that email address. Please check your email or register for a new account.");
        else if (err?.code === "auth/wrong-password") showMsg("error", "The password you entered is incorrect. Please try again or reset your password if you've forgotten it.");
        else showMsg("error", "An unexpected error occurred while signing in. Please try again later or contact support.");
      } finally {
        setLoginLoading(false);
      }
    },
    [loginEmail, loginPassword, navigate]
  );

  // REGISTER - UPDATED WITH createdByPatient FLAG
  const handleRegisterSubmit = useCallback(
    async (ev) => {
      ev?.preventDefault();
      setMessage(null);

      if (!regFirstName.trim() || !regLastName.trim()) return showMsg("error", "Please provide your full name.");
      if (!isValidEmail(regEmail)) return showMsg("error", "Please provide a valid email.");
      if (!regContact || regContact.length !== 10) return showMsg("error", "Contact number must be 10 digits (after +63).");
      if (!regAddress.trim()) return showMsg("error", "Please provide an address.");
      if (regScore < 3) return showMsg("error", "Choose a stronger password (at least 3/5).");
      if (regPassword !== regConfirm) return showMsg("error", "Passwords do not match.");
      if (!agreeTerms) return showMsg("error", "You must agree to the terms.");

      setRegLoading(true);
      try {
        const cred = await createUserWithEmailAndPassword(auth, regEmail.trim().toLowerCase(), regPassword);
        const user = cred.user;
        if (!user?.uid) throw new Error("No user returned");

        const formattedContact = `+63${regContact}`;

        // CRITICAL: Add createdByPatient: true for self-registration
        await setDoc(
          doc(db, "users", user.uid),
          {
            uid: user.uid,
            firstName: regFirstName.trim(),
            lastName: regLastName.trim(),
            address: regAddress.trim(),
            contactNumber: formattedContact,
            email: regEmail.trim().toLowerCase(),
            role: "patient",
            emailVerified: user.emailVerified || false,
            createdByPatient: true, // Patient created their own account
            passwordChoiceMade: true, // Skip password choice modal
            createdAt: serverTimestamp(),
          },
          { merge: true }
        ).catch((e) => console.warn("setDoc error:", e));

        await sendEmailVerification(user).catch((e) => console.warn("sendEmailVerification error:", e));

        // After registration, sign out and redirect to login with reminder
        await signOut(auth);
        setView("login");
        showMsg(
          "success",
          "Account created! Please check your email (including spam/junk folder) for the verification link before logging in."
        );
      } catch (err) {
        console.error("Register error:", err);
        const msg = extractFirebaseError(err);
        if (err?.code === "auth/email-already-in-use") showMsg("error", "Email already registered. Try signing in.");
        else if (err?.code === "auth/weak-password") showMsg("error", "Password is too weak.");
        else showMsg("error", msg || "Failed to create account.");
      } finally {
        setRegLoading(false);
      }
    },
    [regFirstName, regLastName, regEmail, regContact, regAddress, regPassword, regConfirm, regScore, agreeTerms]
  );

  const handleForgotSubmit = useCallback(
    async (ev) => {
      ev?.preventDefault();
      setMessage(null);
      if (!isValidEmail(forgotEmail)) return showMsg("error", "Enter a valid email.");

      try {
        await sendPasswordResetEmail(auth, forgotEmail.trim().toLowerCase());
        showMsg(
          "success",
          "Reset email sent! Please check your email (including spam/junk folder) for the reset link."
        );
        setTimeout(() => {
          setView("login");
          setForgotEmail("");
        }, 900);
      } catch (err) {
        console.error("Forgot error:", err);
        if (err?.code === "auth/user-not-found") showMsg("error", "We could not find an account with that email address. Please check your email or register for a new account.");
        else showMsg("error", "An error occurred while sending the reset email. Please try again later or contact support.");
      }
    },
    [forgotEmail]
  );

  const switchTo = (v) => {
    setView(v);
    setMessage(null);
    setTimeout(() => firstInputRef.current?.focus(), 60);
  };

  const handleRegContactChange = (e) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
    setRegContact(digits);
  };

  const openTermsModal = () => {
    setIsTermsOpen(true);
  };

  const closeTermsModal = () => {
    setIsTermsOpen(false);
  };

  // Render
  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-blue-50 flex items-center justify-center p-4">
      <ToastContainer position="top-right" autoClose={3000} />

      {/* Terms and Conditions Modal */}
      <TermsModal isOpen={isTermsOpen} onClose={closeTermsModal} />

      <div ref={modalRef} className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="grid md:grid-cols-5">
          {/* Left Panel with background image */}
          <div
            className="hidden md:flex md:col-span-2 flex-col justify-center items-start p-12 relative overflow-hidden rounded-l-2xl"
            style={{
              backgroundImage: `url(${loginImg || ""})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                background: "linear-gradient(180deg, rgba(0,0,0,0.48) 0%, rgba(0,0,0,0.38) 40%, rgba(0,0,0,0.32) 100%)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
              }}
              aria-hidden="true"
            />

            <div className="relative z-10 w-full max-w-[380px] text-white">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur flex items-center justify-center font-bold text-2xl">
                  ADC
                </div>
                <div>
                  <h3 className="text-2xl font-bold">Abeledo Dental</h3>
                  <p className="text-sm opacity-90">Patient Portal</p>
                </div>
              </div>

              <p className="text-sm leading-relaxed opacity-90 mb-6">
                Book appointments, manage your dental records, and access billing information all in one secure place.
              </p>

              <div className="space-y-3 mt-2 text-sm opacity-95">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5" />
                  <span>Easy appointment scheduling</span>
                </div>
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5" />
                  <span>Secure & encrypted data</span>
                </div>
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5" />
                  <span>Personalized care tracking</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Forms */}
          <div className="md:col-span-3 p-8 md:p-12 max-h-[90vh] overflow-y-auto relative">
            {/* Exit/X Button */}
            <button
              onClick={() => navigate("/")}
              className="absolute top-4 right-4 z-20 p-2 rounded-full hover:bg-gray-100 transition"
              aria-label="Close"
              type="button"
            >
              <IconX size={28} className="text-gray-500" />
            </button>

            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 capitalize">
                  {view === "login" ? "Welcome Back" : view === "register" ? "Create Account" : "Reset Password"}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {view === "login" ? "Sign in to your account" : view === "register" ? "Register for appointment booking" : "Enter your email to reset password"}
                </p>
              </div>
            </div>

            {message && (
              <div
                className={`mb-6 px-5 py-3 rounded-xl text-sm font-medium ${
                  message.type === "success"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : message.type === "error"
                    ? "bg-rose-50 text-rose-700 border border-rose-200"
                    : "bg-blue-50 text-blue-900 border border-blue-800"
                }`}
              >
                {message.text}
              </div>
            )}

            {view === "login" && (
              <LoginForm
                loginEmail={loginEmail}
                setLoginEmail={setLoginEmail}
                loginPassword={loginPassword}
                setLoginPassword={setLoginPassword}
                loginShowPassword={loginShowPassword}
                setLoginShowPassword={setLoginShowPassword}
                loginLoading={loginLoading}
                handleLoginSubmit={handleLoginSubmit}
                switchTo={switchTo}
                regFieldPrefix={regFieldPrefix}
                firstInputRef={firstInputRef}
              />
            )}

            {view === "register" && (
              <RegisterForm
                regFirstName={regFirstName}
                setRegFirstName={setRegFirstName}
                regLastName={regLastName}
                setRegLastName={setRegLastName}
                regEmail={regEmail}
                setRegEmail={setRegEmail}
                regContact={regContact}
                handleRegContactChange={handleRegContactChange}
                regAddress={regAddress}
                setRegAddress={setRegAddress}
                regPassword={regPassword}
                setRegPassword={setRegPassword}
                regConfirm={regConfirm}
                setRegConfirm={setRegConfirm}
                regShowPassword={regShowPassword}
                setRegShowPassword={setRegShowPassword}
                agreeTerms={agreeTerms}
                setAgreeTerms={setAgreeTerms}
                regLoading={regLoading}
                handleRegisterSubmit={handleRegisterSubmit}
                switchTo={switchTo}
                regFieldPrefix={regFieldPrefix}
                firstInputRef={firstInputRef}
                regChecks={regChecks}
                regScore={regScore}
                regScoreInfo={regScoreInfo}
                regProgress={regProgress}
                onOpenTerms={openTermsModal}
              />
            )}

            {view === "forgot" && (
              <ForgotPasswordForm
                forgotEmail={forgotEmail}
                setForgotEmail={setForgotEmail}
                handleForgotSubmit={handleForgotSubmit}
                switchTo={switchTo}
                firstInputRef={firstInputRef}
              />
            )}

            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-xs text-gray-500 text-center">Abeledo Dental Clinic — Secure Portal</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}