// components/StatCard.jsx
import { Link } from 'react-router-dom';
const StatCard = ({ title, count, link }) => {
  const CardContent = (
    <div className="bg-white p-4 hover:bg-gray-200 rounded-lg shadow-md flex justify-between items-center">
      <span className="text-gray-600">{title}</span>
      <span className="bg-gray-800 text-white rounded-full px-3 py-1">{count}</span>
    </div>
  );

  if (link) {
    return <Link to={`/${link}`}>{CardContent}</Link>;
  }

  return CardContent;
};

export default StatCard;
