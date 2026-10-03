import { useSignup } from '../../hooks/auth/useSignup';
import { Navigate, useNavigate } from 'react-router-dom';

const SignupForm = () => {
    const { mutate: signup, isPending, isError, error } = useSignup();
    const navigate = useNavigate();

    const handleSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        const userData = {
            name: formData.get('name'),
            email: formData.get('email'),
            password: formData.get('password'),
            is_admin: formData.get('role') === 'admin',
            is_franchise: formData.get('role') === 'franchise',
            is_merchant: formData.get('role') === 'merchant',
        };
        console.log(userData, "userData");
        signup(userData, {
            onSuccess: () => {
                navigate('/login');
            }
        })
    }

return (
    <form onSubmit={handleSubmit} className="space-y-4">
        <div>
            <input
                type="text"
                name="name"
                placeholder="Name"
                className="w-full p-2 border rounded"
                required
            />
        </div>
        <div>
            <input
                type="email"
                name="email"
                placeholder="Email"
                className="w-full p-2 border rounded"
                required
            />
        </div>
        <div>
            <input
                type="password"
                name="password"
                placeholder="Password"
                className="w-full p-2 border rounded"
                required
            />
        </div>
        <div>
            <select name="role" className="w-full p-2 border rounded" required>
                <option value="">Select Role</option>
                <option value="franchise">Franchise</option>
                <option value="merchant">Merchant</option>
                <option value="admin">Admin</option>
            </select>
        </div>
        
        {isError && <p className="text-red-500">{error.message}</p>}
        <button
            type="submit"
            disabled={isPending}
            className="w-full p-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-blue-300"
        >
            {isPending ? 'Signing up...' : 'Sign Up'}
        </button>
    </form>
);
};

export default SignupForm;