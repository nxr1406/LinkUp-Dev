import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, setDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { Eye, EyeOff, XCircle, CheckCircle2, Plus, User } from 'lucide-react';
import { toast } from 'sonner';
import { uploadImageToCatbox } from '../services/catbox';

export default function Register() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [usernameError, setUsernameError] = useState('');
  const [isUsernameValid, setIsUsernameValid] = useState(false);
  
  const [emailError, setEmailError] = useState('');
  const [isEmailAvailable, setIsEmailAvailable] = useState(false);
  
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    const checkUsername = async () => {
      if (username.length < 3) {
        setUsernameError('');
        setIsUsernameValid(false);
        return;
      }
      if (!/^[a-z0-9_]+$/.test(username)) {
        setUsernameError('Lowercase letters, numbers, underscores only');
        setIsUsernameValid(false);
        return;
      }
      
      try {
        const q = query(collection(db, 'users'), where('username', '==', username));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          setUsernameError('Username taken');
          setIsUsernameValid(false);
        } else {
          setUsernameError('');
          setIsUsernameValid(true);
        }
      } catch (error: any) {
        if (error.code === 'permission-denied' || error.message?.includes('permission')) {
          setUsernameError('');
          setIsUsernameValid(true);
        } else {
          console.error("Error checking username:", error);
          setUsernameError('Error checking username');
          setIsUsernameValid(false);
        }
      }
    };

    const timeoutId = setTimeout(checkUsername, 500);
    return () => clearTimeout(timeoutId);
  }, [username]);

  useEffect(() => {
    const checkEmail = async () => {
      const isValidFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!isValidFormat) {
        setEmailError('');
        setIsEmailAvailable(false);
        return;
      }
      
      try {
        const q = query(collection(db, 'users'), where('email', '==', email));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          setEmailError('Email already registered');
          setIsEmailAvailable(false);
        } else {
          setEmailError('');
          setIsEmailAvailable(true);
        }
      } catch (error: any) {
        console.error("Error checking email:", error);
        if (error.code === 'permission-denied' || error.message?.includes('permission')) {
          setEmailError('');
          setIsEmailAvailable(true);
        } else {
          setEmailError('Error checking email');
          setIsEmailAvailable(false);
        }
      }
    };

    const timeoutId = setTimeout(checkEmail, 500);
    return () => clearTimeout(timeoutId);
  }, [email]);

  const handleAvatarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || loading) return;
    
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      let avatarUrl = '';
      if (avatarFile) {
        setUploadingAvatar(true);
        try {
          avatarUrl = await uploadImageToCatbox(avatarFile);
        } catch (error: any) {
          toast.error(`Image upload failed, but account created. You can update your profile picture later.`);
          console.error(error);
        }
      }

      await setDoc(doc(db, 'users', user.uid), {
        fullName,
        username,
        email,
        avatarUrl,
        bio: '',
        isOnline: true,
        lastSeen: serverTimestamp(),
        createdAt: serverTimestamp(),
        isVerified: false,
        verificationStatus: 'none',
        role: 'user'
      });

      navigate('/app');
    } catch (error: any) {
      console.error("Registration error:", error);
      const errorCode = error.code || '';
      const errorMessage = error.message || '';

      if (errorCode === 'auth/email-already-in-use' || errorMessage.includes('auth/email-already-in-use')) {
        toast.error('This email is already registered. Please log in.');
      } else if (errorCode === 'auth/invalid-email' || errorMessage.includes('auth/invalid-email')) {
        toast.error('Invalid email address.');
      } else if (errorCode === 'auth/weak-password' || errorMessage.includes('auth/weak-password')) {
        toast.error('Password is too weak.');
      } else {
        toast.error('Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
      setUploadingAvatar(false);
    }
  };

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isPasswordValid = password.length >= 8;
  const isConfirmValid = password === confirmPassword && password.length > 0;
  const isFullNameValid = fullName.length >= 2;
  
  const isValid = isFullNameValid && isUsernameValid && isEmailAvailable && isPasswordValid && isConfirmValid;

  return (
    <div className="flex flex-col h-screen bg-white">
      <div className="flex-1 overflow-y-auto flex flex-col items-center px-4 py-8">
        <div className="w-16 h-16 mb-6">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <defs>
              <linearGradient id="gradReg" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#FCAF45" />
                <stop offset="25%" stopColor="#F77737" />
                <stop offset="50%" stopColor="#F56040" />
                <stop offset="75%" stopColor="#C13584" />
                <stop offset="100%" stopColor="#833AB4" />
              </linearGradient>
            </defs>
            <path d="M50 10C27.9 10 10 27.9 10 50c0 10.6 4.1 20.2 10.8 27.4l-3.6 10.8c-.4 1.2.8 2.4 2 2l10.8-3.6C37.2 83.3 43.4 85 50 85c22.1 0 40-17.9 40-40S72.1 10 50 10z" fill="url(#gradReg)" />
          </svg>
        </div>

        <div className="relative mb-6">
          <label className="cursor-pointer block">
            <div className="w-20 h-20 rounded-full bg-[#DBDBDB] flex items-center justify-center overflow-hidden">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User size={40} className="text-white" />
              )}
            </div>
            <div className="absolute bottom-0 right-0 w-6 h-6 bg-[#0095F6] rounded-full border-2 border-white flex items-center justify-center">
              <Plus size={16} className="text-white" />
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarPick} />
          </label>
          {uploadingAvatar && <div className="mt-2 h-1 w-full bg-gray-200 overflow-hidden rounded"><div className="h-full bg-[#0095F6] animate-pulse"></div></div>}
        </div>

        <form onSubmit={handleRegister} className="w-full max-w-sm space-y-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full h-11 bg-[#FAFAFA] border border-[#DBDBDB] rounded-md px-3 text-[14px] focus:outline-none focus:border-[#8E8E8E]"
            />
            {fullName.length > 0 && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {isFullNameValid ? <CheckCircle2 size={20} className="text-[#00C853]" /> : <XCircle size={20} className="text-[#ED4956]" />}
              </div>
            )}
          </div>

          <div>
            <div className="relative">
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                className="w-full h-11 bg-[#FAFAFA] border border-[#DBDBDB] rounded-md px-3 text-[14px] focus:outline-none focus:border-[#8E8E8E]"
              />
              {username.length > 0 && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {isUsernameValid ? <CheckCircle2 size={20} className="text-[#00C853]" /> : <XCircle size={20} className="text-[#ED4956]" />}
                </div>
              )}
            </div>
            {usernameError && <p className="text-[#ED4956] text-[12px] mt-1">{usernameError}</p>}
          </div>

          <div>
            <div className="relative">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 bg-[#FAFAFA] border border-[#DBDBDB] rounded-md px-3 text-[14px] focus:outline-none focus:border-[#8E8E8E]"
              />
              {email.length > 0 && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {isEmailAvailable ? <CheckCircle2 size={20} className="text-[#00C853]" /> : <XCircle size={20} className="text-[#ED4956]" />}
                </div>
              )}
            </div>
            {emailError && <p className="text-[#ED4956] text-[12px] mt-1">{emailError}</p>}
          </div>

          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-11 bg-[#FAFAFA] border border-[#DBDBDB] rounded-md px-3 text-[14px] focus:outline-none focus:border-[#8E8E8E] pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E8E8E]"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full h-11 bg-[#FAFAFA] border border-[#DBDBDB] rounded-md px-3 text-[14px] focus:outline-none focus:border-[#8E8E8E]"
            />
            {confirmPassword.length > 0 && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {isConfirmValid ? <CheckCircle2 size={20} className="text-[#00C853]" /> : <XCircle size={20} className="text-[#ED4956]" />}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={!isValid || loading}
            className="w-full h-11 mt-4 bg-[#0095F6] text-white font-semibold rounded-lg disabled:opacity-50"
          >
            {loading ? 'Signing up...' : 'Sign up'}
          </button>
        </form>

        <div className="flex items-center w-full max-w-sm my-6">
          <div className="flex-1 h-[0.5px] bg-[#DBDBDB]"></div>
          <span className="px-4 text-[13px] font-semibold text-[#8E8E8E]">OR</span>
          <div className="flex-1 h-[0.5px] bg-[#DBDBDB]"></div>
        </div>
      </div>

      <div className="border-t border-[#DBDBDB] py-4 flex justify-center shrink-0">
        <p className="text-[14px] text-[#8E8E8E]">
          Already have an account? <Link to="/login" className="font-semibold text-[#0095F6]">Log in</Link>
        </p>
      </div>
    </div>
  );
}
