import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { getTodayPayout } from '../api/DashboardAndHeader';
import Table from '../components/Table';
import Loader from '../components/Loader';
import { useNavigate } from 'react-router-dom';

const TodayPayouts = ({ currentUser }) => {
  const normalizeRole = (value) => {
    const roleValue = String(value || '').trim().toLowerCase();
    if (roleValue === 'franchaise') return 'franchise';
    return roleValue;
  };
  const role = normalizeRole(currentUser?.role);
  const navigate = useNavigate();
  const { data: getTotalPayout, isLoading, isError } = useQuery({
    queryKey: ['totalPayouts'],
    queryFn: getTodayPayout,
  });

  if (isLoading) {
    return <Loader />
  }

  if (isError) {
    return navigate(role === 'franchise' ? '/franchise/dashboard' : `/${role}/dashboard`)
  }

  console.log(getTotalPayout, "get")

  const columns = [
    {
      header: 'ID',
      key: 'id',
    },
    {
      header: 'Amount',
      key: 'amount',
    },
    {
      header: 'Approved By',
      key: 'approved_by',
    },
    {
      header: 'Reason',
      key: 'reason'
    },
    {
      header: "Requested By",
      key: "requested_by"
    },
    {
      header: 'Status',
      key: 'status',
      render: (status) => (
        <span
          className={`px-2 py-1 rounded-full text-sm ${status === 'completed'
              ? 'bg-green-100 text-green-700'
              : status === 'pending'
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-red-100 text-red-700'
            }`}
        >
          {status}
        </span>
      ),
    },
    {
      header: 'Update',
      key: 'updatedAt',
    },
  ];

  return (
    <Table columns={columns} data={getTotalPayout?.data} />
  );
};

export default TodayPayouts;
