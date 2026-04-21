import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode'; 
import Layout from './components/Layout';
import Members from './pages/Members';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import ManageUsers from './pages/ManageUsers';
import Attendance from './pages/Attendance';
import GuestValidation from './pages/GuestValidation';
import AttendanceReport from './pages/AttendanceReport';
import AIChat from './pages/AIChat';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null); // Menyimpan jabatan ('admin' atau 'leader')

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setIsAuthenticated(true);
        setUserRole(decoded.role); 
      } catch (error) {
        localStorage.clear();
      }
    }
  }, []);

  const handleLogin = (token) => {
    const decoded = jwtDecode(token);
    setIsAuthenticated(true);
    setUserRole(decoded.role);
  };
  console.log('User Role:', userRole); // Debugging: Cek nilai userRole
  return (
    <Router>
      <Routes>
        <Route 
          path="/login" 
          element={(()=>{
            if (!isAuthenticated) {
              return <Login onLogin={handleLogin} />;
            }
            
            return <Navigate to="/" replace />;
          })()}
        />

        <Route 
          path="/" 
          element={isAuthenticated ? <Layout role={userRole} /> : <Navigate to="/login" replace />}
        >
          {/* Semua Role bisa melihat Dashboard */}
          <Route index element={<Dashboard />} />
          
          {/* HANYA ADMIN yang bisa mengakses menu Members dan Kehadiran CCTV */}
          <Route 
            path="members" 
            element={userRole === 'admin' ? <Members /> : <Navigate to="/" replace />} 
          />
          <Route 
            path="attendance" 
            element={userRole === 'admin' ? <Attendance /> : <Navigate to="/" replace />} 
          />
          <Route 
            path="manage-users" 
            element={userRole === 'admin' ? <ManageUsers /> : <Navigate to="/" replace />} 
          />
          <Route 
            path="validation" 
            element={userRole === 'admin' ? <GuestValidation /> : <Navigate to="/" replace />} 
          />
          <Route 
            path="report" 
            element={<AttendanceReport />} 
          />
          <Route
            path="chat"
            element={userRole === 'leader' ? <AIChat /> : <Navigate to="/" replace />}
          />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;