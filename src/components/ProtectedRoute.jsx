import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const ProtectedRoute = ({ children, allowedRole }) => {
  const { isAuthenticated, userRole } = useAuth();

//   if (!isAuthenticated) {
//     return <Navigate to="/login"  />;
//   }

//   const hasRequiredRole =
//     (allowedRole === 'admin' && userRole.isAdmin) ||
//     (allowedRole === 'franchise' && userRole.isFranchise) ||
//     (allowedRole === 'merchant' && userRole.isMerchant);

//     console.log(hasRequiredRole, "hasRequiredRole")

//   if (!hasRequiredRole) {
//     if (userRole.isAdmin) {
//       return <Navigate to="/admin/dashboard"  />;
//     } else if (userRole.isFranchise) {
//       return <Navigate to="/franchise/dashboard"  />;
//     } else if (userRole.isMerchant) {
//       return <Navigate to="/merchant/dashboard"  />;
//     }
//   }

  return children;
};

export default ProtectedRoute;
