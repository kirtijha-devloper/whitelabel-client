// components/StatCard.jsx
import { Link } from 'react-router-dom';
const StatCard = ({ title, count, link }) => {
  const CardContent = (
    <div className={`bg-white p-4 rounded-lg shadow-md flex justify-between items-center transition-all duration-150 ${link ? 'hover:bg-gray-100 hover:shadow-lg cursor-pointer active:scale-[0.99]' : ''}`}>
      <span className="text-gray-700 font-medium">{title}</span>
      <span className="bg-gray-800 text-white rounded-full px-3 py-1 font-semibold text-sm shadow-sm">{count}</span>
    </div>
  );

  if (link) {
    const toPath = link.startsWith('/') ? link : `/${link}`;
    return <Link to={toPath} className="block">{CardContent}</Link>;
  }

  return CardContent;
};

export default StatCard;
