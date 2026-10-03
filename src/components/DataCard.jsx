
import { FaMoneyBillWave, FaWallet, FaCreditCard } from "react-icons/fa";

const DataCard = ({ title, amount, currency = "₹", className }) => {
  const getIcon = () => {
    if (title.toLowerCase().includes("pos") || title.toLowerCase().includes("payout")) {
      return <FaMoneyBillWave className="text-3xl" />;
    } else if (title.toLowerCase().includes("cc")) {
      return <FaCreditCard className="text-3xl" />;
    }
    return <FaWallet className="text-3xl" />;
  };

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm">
      <h3 className="text-gray-600 text-sm mb-2">{title}</h3>
      {typeof amount === 'number' ? (
        <p className="text-2xl font-bold text-gray-800">₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
      ) : (
        <div className="text-gray-800 font-semibold">{amount}</div>
      )}
      <div className={`h-1 mt-4 rounded-full ${
        title.includes('Success') ? 'bg-green-500' :
        title.includes('Failed') ? 'bg-red-500' : 'bg-blue-500'
      }`}></div>
    </div>
  );
};

export default DataCard;
