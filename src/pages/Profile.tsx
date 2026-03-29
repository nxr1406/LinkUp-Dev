import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { auth, db } from '../firebase';
import { collection, query, where, getDocs, doc, deleteDoc, updateDoc, setDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { Menu, Plus, Bell, Lock, Download, LogOut, Trash2, X, Check, BadgeCheck, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { uploadImageToCatbox } from '../services/catbox';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

export default function Profile() {
  const { currentUser, userData } = useAuth();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [chatCount, setChatCount] = useState(0);
  
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [showVerification, setShowVerification] = useState(false);
  const [verificationLink, setVerificationLink] = useState('');
  const [verificationCategory, setVerificationCategory] = useState('creator');
  const [submittingVerification, setSubmittingVerification] = useState(false);

  useEffect(() => {
    if (userData) {
      setEditName(userData.fullName || '');
      setEditUsername(userData.username || '');
      setEditBio(userData.bio || '');
    }
  }, [userData]);

  useEffect(() => {
    if (!currentUser) return;
    const fetchChatCount = async () => {
      try {
        const q = query(collection(db, 'chats'), where('participants', 'array-contains', currentUser.uid));
        const snapshot = await getDocs(q);
        setChatCount(snapshot.size);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'chats');
      }
    };
    fetchChatCount();
  }, [currentUser]);

  const handleLogout = async () => {
    if (currentUser) {
      try {
        await setDoc(doc(db, 'users', currentUser.uid), {
          isOnline: false,
          lastSeen: serverTimestamp()
        }, { merge: true });
      } catch (error) {
        console.error('Error updating online status on logout:', error);
      }
    }
    await auth.signOut();
    navigate('/login');
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm("Delete account? This will permanently delete your account and all messages. This can't be undone.")) return;
    
    try {
      if (currentUser) {
        await deleteDoc(doc(db, 'users', currentUser.uid));
        await currentUser.delete();
        navigate('/');
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleExportData = async () => {
    toast.loading('Preparing your data...');
    try {
      const exportData = {
        exportedAt: new Date().toISOString(),
        user: {
          uid: currentUser?.uid,
          ...userData
        },
        conversations: []
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `linkup_export_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.dismiss();
      toast.success('Data exported successfully');
    } catch (error) {
      toast.dismiss();
      toast.error('Export failed');
    }
  };

  const handleAvatarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const saveProfile = async () => {
    if (!currentUser) return;
    
    const newUsername = editUsername.toLowerCase().replace(/\s+/g, '_');
    if (newUsername.length < 3) {
      toast.error('Username must be at least 3 characters');
      return;
    }
    if (!/^[a-z0-9_]+$/.test(newUsername)) {
      toast.error('Username can only contain letters, numbers, and underscores');
      return;
    }

    setSaving(true);
    try {
      if (newUsername !== userData?.username) {
        const q = query(collection(db, 'users'), where('username', '==', newUsername));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          toast.error('Username is already taken');
          setSaving(false);
          return;
        }
      }

      let avatarUrl = userData?.avatarUrl || '';
      if (avatarFile) {
        avatarUrl = await uploadImageToCatbox(avatarFile);
      }
      
      await updateDoc(doc(db, 'users', currentUser.uid), {
        fullName: editName,
        username: newUsername,
        bio: editBio,
        avatarUrl
      });
      
      setShowEdit(false);
      toast.success('Profile updated');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const submitVerification = async () => {
    if (!currentUser || !verificationLink.trim()) {
      toast.error('Please provide a Google Drive link');
      return;
    }
    
    // Basic validation for Google Drive link
    if (!verificationLink.includes('drive.google.com')) {
      toast.error('Please provide a valid Google Drive link');
      return;
    }
    
    setSubmittingVerification(true);
    try {
      await addDoc(collection(db, 'verificationRequests'), {
        userId: currentUser.uid,
        username: userData?.username,
        fullName: userData?.fullName,
        avatarUrl: userData?.avatarUrl || null,
        category: verificationCategory,
        documentUrl: verificationLink,
        status: 'pending',
        timestamp: serverTimestamp()
      });
      
      await updateDoc(doc(db, 'users', currentUser.uid), {
        verificationStatus: 'pending'
      });
      
      toast.success('Verification request submitted');
      setShowVerification(false);
      setShowMenu(false);
    } catch (error: any) {
      console.error('Error submitting verification:', error);
      toast.error('Failed to submit request');
    } finally {
      setSubmittingVerification(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white relative">
      <div className="flex items-center justify-between px-4 h-14 shrink-0">
        <div className="flex items-center">
          <Lock size={14} className="mr-1 text-[#262626]" />
          <h1 className="text-[20px] font-bold text-[#262626] mr-1">{userData?.username}</h1>
          {userData?.isVerified && <BadgeCheck size={18} className="text-[#0095F6]" fill="#0095F6" color="white" />}
        </div>
        <div className="flex items-center space-x-4">
          <button><Plus size={24} className="text-[#262626]" strokeWidth={1.5} /></button>
          <button onClick={() => setShowMenu(true)}><Menu size={24} className="text-[#262626]" strokeWidth={1.5} /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-2 pb-8">
          <div className="flex flex-col items-center mt-6">
            <div className="w-28 h-28 rounded-full bg-[#DBDBDB] overflow-hidden shrink-0 border-4 border-white shadow-sm">
              {userData?.avatarUrl ? (
                <img src={userData.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white text-[40px] font-semibold">
                  {userData?.fullName?.[0]?.toUpperCase()}
                </div>
              )}
            </div>
            
            <div className="flex items-center mt-4">
              <h2 className="text-[22px] font-bold text-[#262626] mr-1">{userData?.fullName}</h2>
              {userData?.isVerified && <BadgeCheck size={20} className="text-[#0095F6]" fill="#0095F6" color="white" />}
            </div>
            <p className="text-[15px] text-[#8E8E8E]">@{userData?.username}</p>
            
            {userData?.bio && (
              <p className="text-[15px] text-[#262626] text-center mt-3 px-8 whitespace-pre-wrap leading-relaxed">
                {userData.bio}
              </p>
            )}
            
            <div className="flex items-center justify-center space-x-8 mt-6 w-full max-w-xs">
              <div className="flex flex-col items-center">
                <span className="text-[20px] font-bold text-[#262626]">{userData?.followers?.length || 0}</span>
                <span className="text-[12px] text-[#8E8E8E] font-semibold uppercase tracking-wider mt-1">Followers</span>
              </div>
              <div className="w-[1px] h-8 bg-[#DBDBDB]"></div>
              <div className="flex flex-col items-center">
                <span className="text-[20px] font-bold text-[#262626]">{userData?.following?.length || 0}</span>
                <span className="text-[12px] text-[#8E8E8E] font-semibold uppercase tracking-wider mt-1">Following</span>
              </div>
            </div>

            <div className="flex space-x-3 mt-8 w-full px-2">
              <button 
                onClick={() => setShowEdit(true)}
                className="flex-1 py-2.5 rounded-xl bg-[#262626] text-[15px] font-semibold text-white shadow-sm active:scale-95 transition-transform"
              >
                Edit Profile
              </button>
              <button className="flex-1 py-2.5 rounded-xl bg-[#EFEFEF] text-[15px] font-semibold text-[#262626] active:scale-95 transition-transform">
                Share Profile
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Bottom Sheet */}
      {showMenu && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowMenu(false)}></div>
          <div className="bg-white w-full rounded-t-2xl relative z-10 animate-in slide-in-from-bottom-full duration-200">
            <div className="w-10 h-1 bg-[#DBDBDB] rounded-full mx-auto mt-3 mb-2"></div>
            <h2 className="text-center text-[16px] font-semibold border-b border-[#DBDBDB] pb-3">Settings</h2>
            <div className="flex flex-col pb-safe">
              <button 
                onClick={() => navigate('/app/notifications')}
                className="flex items-center px-4 py-3 active:bg-gray-50"
              >
                <Bell size={24} className="text-[#262626] mr-3" strokeWidth={1.5} />
                <span className="text-[15px] text-[#262626]">Notifications</span>
              </button>
              <button 
                onClick={() => navigate('/app/privacy')}
                className="flex items-center px-4 py-3 active:bg-gray-50"
              >
                <Lock size={24} className="text-[#262626] mr-3" strokeWidth={1.5} />
                <span className="text-[15px] text-[#262626]">Privacy</span>
              </button>
              <button 
                onClick={() => navigate('/app/blocked')}
                className="flex items-center px-4 py-3 active:bg-gray-50"
              >
                <Lock size={24} className="text-[#262626] mr-3" strokeWidth={1.5} />
                <span className="text-[15px] text-[#262626]">Blocked accounts</span>
              </button>
              <button 
                onClick={() => {
                  setShowMenu(false);
                  setShowVerification(true);
                }}
                className="flex items-center px-4 py-3 active:bg-gray-50"
              >
                <ShieldCheck size={24} className="text-[#262626] mr-3" strokeWidth={1.5} />
                <span className="text-[15px] text-[#262626]">Request Verification</span>
              </button>
              {userData?.role === 'admin' && (
                <button 
                  onClick={() => navigate('/app/admin/verification')}
                  className="flex items-center px-4 py-3 active:bg-gray-50"
                >
                  <ShieldCheck size={24} className="text-[#0095F6] mr-3" strokeWidth={1.5} />
                  <span className="text-[15px] text-[#0095F6] font-semibold">Review Verifications</span>
                </button>
              )}
              <div className="h-[0.5px] bg-[#DBDBDB] my-1"></div>
              <button onClick={handleExportData} className="flex items-center px-4 py-3 active:bg-gray-50">
                <Download size={24} className="text-[#262626] mr-3" strokeWidth={1.5} />
                <span className="text-[15px] text-[#262626]">Export Data</span>
              </button>
              <div className="h-[0.5px] bg-[#DBDBDB] my-1"></div>
              <button onClick={handleLogout} className="flex items-center px-4 py-3 active:bg-gray-50">
                <LogOut size={24} className="text-[#ED4956] mr-3" strokeWidth={1.5} />
                <span className="text-[15px] text-[#ED4956]">Log out</span>
              </button>
              <button onClick={handleDeleteAccount} className="flex items-center px-4 py-3 active:bg-gray-50">
                <Trash2 size={24} className="text-[#ED4956] mr-3" strokeWidth={1.5} />
                <span className="text-[15px] text-[#ED4956]">Delete Account</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Bottom Sheet */}
      {showEdit && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowEdit(false)}></div>
          <div className="bg-white w-full h-[90%] rounded-t-2xl relative z-10 flex flex-col animate-in slide-in-from-bottom-full duration-200">
            <div className="flex items-center justify-between px-4 h-12 border-b border-[#DBDBDB] shrink-0">
              <button onClick={() => setShowEdit(false)}><X size={24} className="text-[#262626]" /></button>
              <h2 className="text-[16px] font-semibold text-[#262626]">Edit profile</h2>
              <button onClick={saveProfile} disabled={saving}>
                {saving ? (
                  <div className="w-5 h-5 border-2 border-[#DBDBDB] border-t-[#0095F6] rounded-full animate-spin"></div>
                ) : (
                  <Check size={24} className="text-[#0095F6]" />
                )}
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex flex-col items-center mb-6">
                <div className="w-20 h-20 rounded-full bg-[#DBDBDB] overflow-hidden mb-3">
                  {avatarPreview || userData?.avatarUrl ? (
                    <img src={avatarPreview || userData?.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white text-[32px] font-semibold">
                      {userData?.fullName?.[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                <label className="text-[14px] font-semibold text-[#0095F6] cursor-pointer">
                  Change photo
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarPick} />
                </label>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[12px] text-[#8E8E8E]">Name</label>
                  <input 
                    type="text" 
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full border-b border-[#DBDBDB] py-2 text-[16px] text-[#262626] focus:outline-none focus:border-[#262626]"
                  />
                </div>
                <div>
                  <label className="text-[12px] text-[#8E8E8E]">Username</label>
                  <input 
                    type="text" 
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="w-full border-b border-[#DBDBDB] py-2 text-[16px] text-[#262626] focus:outline-none focus:border-[#262626]"
                  />
                </div>
                <div>
                  <label className="text-[12px] text-[#8E8E8E]">Bio</label>
                  <input 
                    type="text" 
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    className="w-full border-b border-[#DBDBDB] py-2 text-[16px] text-[#262626] focus:outline-none focus:border-[#262626]"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Verification Modal */}
      {showVerification && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowVerification(false)}></div>
          <div className="bg-white w-full h-[90%] rounded-t-2xl relative z-10 flex flex-col animate-in slide-in-from-bottom-full duration-200">
            <div className="flex items-center justify-between px-4 h-12 border-b border-[#DBDBDB] shrink-0">
              <button onClick={() => setShowVerification(false)}><X size={24} className="text-[#262626]" /></button>
              <h2 className="text-[16px] font-semibold text-[#262626]">Request Verification</h2>
              <button 
                onClick={submitVerification} 
                disabled={submittingVerification || !verificationLink.trim()}
                className="disabled:opacity-50"
              >
                {submittingVerification ? (
                  <div className="w-5 h-5 border-2 border-[#DBDBDB] border-t-[#0095F6] rounded-full animate-spin"></div>
                ) : (
                  <Check size={24} className="text-[#0095F6]" />
                )}
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {userData?.isVerified ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <BadgeCheck size={64} className="text-[#0095F6] mb-4" fill="#0095F6" color="white" />
                  <h3 className="text-[20px] font-bold text-[#262626] mb-2">You are verified</h3>
                  <p className="text-[15px] text-[#8E8E8E]">Your account has a verified badge.</p>
                </div>
              ) : userData?.verificationStatus === 'pending' ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <ShieldCheck size={64} className="text-[#8E8E8E] mb-4" />
                  <h3 className="text-[20px] font-bold text-[#262626] mb-2">Request Pending</h3>
                  <p className="text-[15px] text-[#8E8E8E]">We are reviewing your request for a verified badge. We'll let you know once a decision has been made.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <p className="text-[14px] text-[#8E8E8E]">
                    A verified badge is a check that appears next to an account's name to indicate that the account is the authentic presence of a notable public figure, celebrity, global brand or entity it represents.
                  </p>
                  
                  <div>
                    <h3 className="text-[16px] font-semibold text-[#262626] mb-4">Step 1: Confirm authenticity</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="text-[12px] text-[#8E8E8E] block mb-1">Document Type</label>
                        <select className="w-full border border-[#DBDBDB] rounded-md py-2 px-3 text-[14px] text-[#262626] focus:outline-none focus:border-[#262626]">
                          <option>Driver's License</option>
                          <option>Passport</option>
                          <option>National Identification Card</option>
                          <option>Tax Filing</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[12px] text-[#8E8E8E] block mb-1">Google Drive PDF Link</label>
                        <input 
                          type="url" 
                          placeholder="https://drive.google.com/file/d/..." 
                          value={verificationLink}
                          onChange={(e) => setVerificationLink(e.target.value)}
                          className="w-full border border-[#DBDBDB] rounded-md py-2 px-3 text-[14px] text-[#262626] focus:outline-none focus:border-[#262626]"
                        />
                        <p className="text-[11px] text-[#8E8E8E] mt-1">Please ensure the link is set to "Anyone with the link can view".</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-[16px] font-semibold text-[#262626] mb-4">Step 2: Confirm notability</h3>
                    <div>
                      <label className="text-[12px] text-[#8E8E8E] block mb-1">Category</label>
                      <select 
                        value={verificationCategory}
                        onChange={(e) => setVerificationCategory(e.target.value)}
                        className="w-full border border-[#DBDBDB] rounded-md py-2 px-3 text-[14px] text-[#262626] focus:outline-none focus:border-[#262626]"
                      >
                        <option value="news">News/Media</option>
                        <option value="sports">Sports</option>
                        <option value="government">Government and Politics</option>
                        <option value="music">Music</option>
                        <option value="fashion">Fashion</option>
                        <option value="entertainment">Entertainment</option>
                        <option value="creator">Digital Creator/Blogger/Influencer</option>
                        <option value="gamer">Gamer</option>
                        <option value="business">Business/Brand/Organization</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
