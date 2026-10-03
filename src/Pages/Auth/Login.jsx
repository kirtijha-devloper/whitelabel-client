import LoginForm from '../../components/Auth/LoginForm';
import { LiaAngleRightSolid } from "react-icons/lia";
import PosImage from '../../assets/pos-image.jpg';
import AbheePayLogo from '../../assets/FORMAT-PNG.png'
import PosSwipe from '../../assets/pos-images/pos-swipe.jpg';
import PosDesktopAndMobile from '../../assets/pos-images/pos-handshake.jpg';
import PosMachine from '../../assets/pos-images/pos-machine.jpeg';
import { ArrowRight } from 'lucide-react';
import PosVideo from '../../assets/POS Payment.mp4'

const Login = () => {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <div
        className="absolute inset-0 z-0 bg-gray-800"
        style={{
          backgroundImage: "url('./pos-machine.jpg')",
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          filter: 'brightness(0.3)'
        }}
      />

      <div className='absolute lg:top-10 top-4 left-4 lg:left-6 z-20'>
        <img src={AbheePayLogo} className="w-32 lg:w-48" alt="AbheePay Logo" />
      </div>

      <div className="relative z-10 flex items-center justify-center min-h-screen px-4 py-8">
        <div className="bg-[#cfeded] w-full max-w-4xl rounded-xl overflow-hidden shadow-2xl">
          <div className='bg-white flex flex-col md:flex-row h-full'>
            <div className="hidden md:block md:w-1/2 relative">
              <video
                autoPlay
                loop
                muted
                playsInline
                className='w-full h-full object-cover'
              >
                <source src={PosVideo} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>

            <div className="w-full md:w-1/2 p-4 sm:p-6 md:p-8 bg-gray-100">
              <div className="max-w-md mx-auto pt-2 md:pt-6">
                <div className="flex justify-center mb-4 md:mb-8">
                  <ArrowRight size={36} className="text-teal-600" />
                </div>

                <div className="text-center mb-6 md:mb-8">
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">Welcome Back</h2>
                  <p className="text-gray-600 text-sm sm:text-base">Please sign in to your account</p>
                </div>

                <LoginForm />

                {/* DEV LOGIN BUTTON */}

              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;