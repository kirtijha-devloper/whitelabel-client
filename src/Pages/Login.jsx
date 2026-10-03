
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const Login = ({ loginData, setIsAuthenticated, setUserRole }) => {
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();

    const userData = loginData.find(
      (u) => u.username === user && u.password === password
    );

    if (userData) {
      localStorage.setItem("user", JSON.stringify(userData));
      setError("");

      setIsAuthenticated(true);
      setUserRole(userData.role);

      navigate("/dashboard");
    } else {
      setError("Invalid username or password");
    }
  };

  return (
    <div className="w-full h-screen flex justify-between items-center bg-gray-100">
      <div>hlo</div>
      <div className="flex flex-col gap-4 p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center">Login</h2>
        {error && <p className="text-red-500 text-center">{error}</p>}
        <input
          type="text"
          placeholder="User Name"
          className="p-2 border-black border-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={user}
          onChange={(e) => setUser(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          className="p-2 border-black border-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          type="submit"
          className="bg-blue-500 hover:bg-blue-600 px-3 py-2 text-white rounded-md transition"
          onClick={handleSubmit}
        >
          Submit
        </button>
      </div>
    </div>
  );
};

export default Login;