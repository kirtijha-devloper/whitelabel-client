import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle, Search, Loader2, X } from "lucide-react";
import { useUserCreation } from "../context/UserCreationContext";
import StepIndicator from "../components/StepIndicator";
import { assignPosMachineToFranchise, getAllPosMachines } from "../api/posMachine";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Select from "react-select";

const steps = ['Basic Info', 'Address & Documents', 'POS Assignment', 'ChargeSet'];

function CreateUserPosDetails({currentUser}) {
  const navigate = useNavigate();
  const { id } = useParams();
  const { state, dispatch } = useUserCreation();
  const [showSuccess, setShowSuccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMachines, setSelectedMachines] = useState([]);
  const queryClient = useQueryClient();

  useEffect(() => {
    dispatch({ type: 'SET_STEP', payload: 3 });
  }, [dispatch]);

  const {
    data: posMachinesData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["posMachines", searchTerm],
    queryFn: () => getAllPosMachines({ tidNumber: searchTerm || null, page: 1, limit: 100 }),
    staleTime: 1000 * 60 * 5, 
  });

  // Extract data array from response
  const posMachines = React.useMemo(() => {
    if (!posMachinesData) return [];
    if (Array.isArray(posMachinesData)) return posMachinesData;
    return Array.isArray(posMachinesData.data) ? posMachinesData.data : [];
  }, [posMachinesData]);

  const assignMutation = useMutation({
    mutationFn: ({ posMachineIds, userId }) =>
      assignPosMachineToFranchise(posMachineIds, userId),
    onSuccess: () => {
      setShowSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["posMachines"] });
      setTimeout(() => {
        setShowSuccess(false);
        const redirectUrl = currentUser.role === "admin" ? `/admin/create-user/charge-set/${id}` :`/franchise/create-user/charge-set/${id}`;
        console.log(redirectUrl, 'redirecturl')
        navigate(redirectUrl);
      }, 1500);
    },
    onError: (error) => {
      alert(error.message || "Failed to assign POS machines");
    },
  });

  const handleSearchChange = ((inputValue) => {
    setSearchTerm(inputValue);
  }, 300);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (selectedMachines.length === 0) {
      alert("Please select at least one POS Machine");
      return;
    }

    // Keep backend payload on POS machine id while showing serial number in UI.
    const posMachineIds = selectedMachines.map(machine => machine.posMachineId ?? machine.value);
    assignMutation.mutate({ posMachineIds, userId: id });
  };

  const selectOptions = posMachines
    .filter(machine => machine.assigned_to === null)
    .map((machine) => ({
      value: machine.id ?? machine.tid_number,
      posMachineId: machine.id ?? machine.tid_number,
      tidNumber: machine.tid_number,
      serialNumber: machine.device_serial_number,
      label: `${machine.status} (Serial No.: ${machine.device_serial_number || machine.tid_number || 'N/A'})`,
    }));

  const handleSelectChange = (selected) => {
    setSelectedMachines(selected || []);
  };

  // Display selected machines
  const SelectedMachinesList = () => {
    if (selectedMachines.length === 0) return null;

    return (
      <div className="mt-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Selected POS Machines:</h3>
        <div className="flex flex-wrap gap-2">
          {selectedMachines.map((machine) => (
            <div
              key={machine.value}
              className="bg-primary/10 text-primary px-3 py-1 rounded-full flex items-center gap-2"
            >
              <span>{machine.label}</span>
              <button
                type="button"
                onClick={() => {
                  setSelectedMachines(selectedMachines.filter(m => m.value !== machine.value));
                }}
                className="hover:text-primary/70"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      <StepIndicator currentStep={state.currentStep} steps={steps} />

      <div className="max-w-2xl mx-auto">
        <div className="flex gap-8 text-center mb-4">
          <div className="flex items-center gap-2">
            <p className="text-lg font-semibold">Role: </p>
            <p className="text-sm font-medium">{state.formData.role}</p>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-lg font-semibold">Name: </p>
            <p className="text-sm font-medium">{state.formData.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-lg font-semibold">Phone: </p>
            <p className="text-sm font-medium">{state.formData.mobile_number}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-6">Assign POS Machines</h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search and Select POS Machines
              </label>
              
              <div className="relative">
                <Select
                  isMulti
                  name="pos_machine_ids"
                  value={selectedMachines}
                  options={selectOptions}
                  onChange={handleSelectChange}
                  isLoading={isLoading}
                  onInputChange={handleSearchChange}
                  placeholder="Search by Device Serial Number or name..."
                  className="w-full"
                  classNamePrefix="react-select"
                  noOptionsMessage={() => 
                    error 
                      ? "Error loading POS machines" 
                      : "No unassigned POS machines found"
                  }
                />
                {isLoading && (
                  <div className="absolute right-10 top-1/2 transform -translate-y-1/2">
                    <Loader2 className="animate-spin h-5 w-5 text-gray-400" />
                  </div>
                )}
              </div>

              <SelectedMachinesList />
            </div>

            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={assignMutation.isPending || selectedMachines.length === 0}
                className={`px-6 py-2 bg-primary text-white rounded-lg flex items-center gap-2
                  ${(assignMutation.isPending || selectedMachines.length === 0) ? 'opacity-70 cursor-not-allowed' : 'hover:bg-primary/90'}`}
              >
                {assignMutation.isPending ? (
                  <>
                    <Loader2 className="animate-spin h-5 w-5" />
                    Assigning...
                  </>
                ) : (
                  'Next Page'
                )}
              </button>
            </div>
          </form>
        </div>

        {showSuccess && (
          <div className="fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
            <CheckCircle size={20} /> POS machines assigned successfully!
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-lg">
            {error.message || "Failed to load POS machines"}
          </div>
        )}
      </div>
    </div>
  );
}

export default CreateUserPosDetails;
