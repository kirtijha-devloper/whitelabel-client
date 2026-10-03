import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { uploadBillAvenueBillers } from "../api/billAvenueApi";

const formatErrorItem = (err, index) => {
  const row = err?.row ?? "?";
  const message = err?.error || err?.message || "Invalid row";
  const data = err?.data ? JSON.stringify(err.data) : "";
  return (
    <div key={`err-${index}`} className="p-2 border border-rose-200 rounded-md bg-rose-50 text-rose-800">
      <p className="font-bold">Row: {row}</p>
      <p>{message}</p>
      {data && <p className="text-xs text-slate-600">{data}</p>}
    </div>
  );
};

export default function BillAvenueBillerUpload() {
  const navigate = useNavigate();
  const location = useLocation();
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState(null);

  const currentRoot = (location.pathname || "").split("/")[1] || "admin";
  const settingsPath = `/${currentRoot}/setting`;

  const handleChange = (event) => {
    const selectedFile = event.target.files?.[0] ?? null;
    setFile(selectedFile);
    setResult(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!file) {
      toast.error("Please select a CSV file before uploading");
      return;
    }

    if (!/\.csv$/i.test(file.name)) {
      toast.error("Only .csv files are supported. Please upload a CSV file.");
      return;
    }

    setIsUploading(true);
    setResult(null);
    try {
      const data = await uploadBillAvenueBillers(file);
      setResult(data);
      toast.success(data.message || "BillAvenue biller list uploaded successfully");
    } catch (error) {
      toast.error(error.message || "Upload failed");
      setResult({ success: false, message: error.message });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold text-gray-900">BillAvenue Biller List Upload</h1>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-3 py-2 rounded-md bg-gray-200 hover:bg-gray-300 text-gray-700"
          >
            Back
          </button>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <p className="mb-4 text-sm text-gray-500">
            Upload CSV / XLS / XLSX file with columns (case-insensitive): billerId, billerName, category, serviceType, circle, state, isActive.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="file"
                accept=".csv"
                onChange={handleChange}
                className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-cyan-50 file:text-cyan-700 hover:file:bg-cyan-100"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={isUploading}
                className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-60"
              >
                {isUploading ? "Uploading..." : "Upload BillAvenue Billers"}
              </button>
              <button
                type="button"
                onClick={() => navigate(settingsPath)}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Go to Settings
              </button>
            </div>
          </form>

          {result && (
            <div className="mt-6 space-y-2">
              <h2 className="text-lg font-semibold">Upload result</h2>
              <p className={`${result.success ? 'text-green-700' : 'text-red-700'}`}>
                {result.message || (result.success ? 'Upload successful' : 'Upload failed')}
              </p>
              {typeof result.imported === 'number' && (
                <p>Imported: {result.imported}</p>
              )}
              {typeof result.skipped === 'number' && (
                <p>Skipped: {result.skipped}</p>
              )}
              {Array.isArray(result.errors) && result.errors.length > 0 && (
                <div className="grid gap-2 mt-2">
                  <p className="font-medium">Errors ({result.errors.length}):</p>
                  {result.errors.map(formatErrorItem)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
