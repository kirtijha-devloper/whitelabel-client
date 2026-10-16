import React from "react";
import { useNavigate } from "react-router-dom";
import {
  FaBox,
  FaQrcode,
  FaServer,
  FaMobileAlt,
  FaArrowRight,
  FaCheckCircle,
  FaExclamationTriangle,
  FaLayerGroup,
  FaExchangeAlt,
} from "react-icons/fa";

const SuperAdminInventoryHub = () => {
  const navigate = useNavigate();

  const inventoryCards = [
    {
      id: "pos",
      title: "POS Inventory",
      subtitle: "POS Machines & Terminal Stock",
      tag: "Hardware Terminal",
      path: "/super-admin/inventory/pos",
      icon: <FaMobileAlt className="w-8 h-8 text-white" />,
      gradient: "from-teal-500 to-emerald-600",
      bgLight: "bg-emerald-50",
      borderColor: "border-emerald-200",
      textColor: "text-emerald-700",
      description:
        "Manage physical POS terminals, machine serial numbers, company stock allocations, active merchant mappings, and machine repair/returns.",
      stats: [
        { label: "Total Machines", value: "5,420" },
        { label: "Available Stock", value: "1,240" },
        { label: "Assigned Devices", value: "3,980" },
        { label: "Returned / Repair", value: "200" },
      ],
      quickBadges: ["Pax A920", "Verifone X990", "MoreFun POS", "Ingenico"],
    },
    {
      id: "qr",
      title: "QR Inventory",
      subtitle: "QR Standees, Soundboxes & Cards",
      tag: "VPA & Soundboxes",
      path: "/super-admin/inventory/qr",
      icon: <FaQrcode className="w-8 h-8 text-white" />,
      gradient: "from-purple-600 to-indigo-600",
      bgLight: "bg-purple-50",
      borderColor: "border-purple-200",
      textColor: "text-purple-700",
      description:
        "Track physical QR code standees, 4G voice soundboxes, physical merchant cards, batch printing dispatches, and VPA merchant mappings.",
      stats: [
        { label: "Total QR Stock", value: "12,850" },
        { label: "Active VPAs", value: "10,200" },
        { label: "Unassigned Stock", value: "2,450" },
        { label: "Voice Soundboxes", value: "3,100" },
      ],
      quickBadges: ["Acrylic Standees", "4G Soundboxes", "NFC QR Cards", "Stickers"],
    },
    {
      id: "pg",
      title: "PG Inventory",
      subtitle: "Payment Gateway MIDs & Routing",
      tag: "Aggregator & MIDs",
      path: "/super-admin/inventory/pg",
      icon: <FaServer className="w-8 h-8 text-white" />,
      gradient: "from-blue-600 to-cyan-600",
      bgLight: "bg-blue-50",
      borderColor: "border-blue-200",
      textColor: "text-blue-700",
      description:
        "Manage Payment Gateway MIDs, Aggregator API keys, routing priority rules, merchant PG account allocations, and processing limits.",
      stats: [
        { label: "Total PG MIDs", value: "1,430" },
        { label: "Active Accounts", value: "1,280" },
        { label: "Unallocated MIDs", value: "110" },
        { label: "Sandbox / Testing", value: "40" },
      ],
      quickBadges: ["Razorpay PG", "Cashfree PG", "Worldline", "HDFC PG"],
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 space-y-8">
      {/* PAGE HEADER */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#00D3CD]/10 text-[#00D3CD] rounded-xl">
              <FaBox className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Super Admin Inventory
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Centralized management for POS hardware, physical QR standees, and PG merchant MIDs.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Inventory Engine Active
          </span>
        </div>
      </div>

      {/* MAIN INVENTORY HUB CARDS SECTION */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Inventory Categories
            </h2>
            <p className="text-xs text-gray-500">
              Select an inventory module to manage stock, assign devices, and view detailed reports.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {inventoryCards.map((card) => (
            <div
              key={card.id}
              onClick={() => navigate(card.path)}
              className="group bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-200 overflow-hidden cursor-pointer flex flex-col justify-between hover:-translate-y-1"
            >
              {/* Card Header Banner */}
              <div className="p-6 relative">
                <div className="flex items-start justify-between">
                  <div
                    className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${card.gradient} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}
                  >
                    {card.icon}
                  </div>
                  <span
                    className={`text-xs font-semibold px-3 py-1 rounded-full ${card.bgLight} ${card.textColor} border ${card.borderColor}`}
                  >
                    {card.tag}
                  </span>
                </div>

                <div className="mt-5">
                  <h3 className="text-xl font-bold text-gray-900 group-hover:text-[#00D3CD] transition-colors flex items-center gap-2">
                    {card.title}
                  </h3>
                  <p className="text-xs font-medium text-gray-400 mt-0.5">
                    {card.subtitle}
                  </p>
                </div>
              </div>


              {/* Card Footer Button */}
              <div className="p-4 bg-white border-t border-gray-100 flex items-center justify-between group-hover:bg-[#00D3CD]/5 transition-colors">
                <span className="text-sm font-bold text-gray-700 group-hover:text-[#00D3CD] transition-colors">
                  Open {card.title}
                </span>
                <div className="w-8 h-8 rounded-full bg-gray-100 group-hover:bg-[#00D3CD] group-hover:text-white text-gray-600 flex items-center justify-center transition-all duration-300">
                  <FaArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SuperAdminInventoryHub;
