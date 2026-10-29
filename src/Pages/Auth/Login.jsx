import LoginForm from '../../components/Auth/LoginForm';
import { LiaAngleRightSolid } from "react-icons/lia";
import PosImage from '../../assets/pos-image.jpg';
import PosSwipe from '../../assets/pos-images/pos-swipe.jpg';
import PosDesktopAndMobile from '../../assets/pos-images/pos-handshake.jpg';
import PosMachine from '../../assets/pos-images/pos-machine.jpeg';
import { ArrowRight } from 'lucide-react';
import PosVideo from '../../assets/POS Payment.mp4';
import { useBranding } from '../../context/BrandingContext';
import defaultLogo from '../../assets/FORMAT-PNG.png';

const Login = () => {
  const { branding } = useBranding();
  const displayLogo = branding.companyLogoUrl || defaultLogo;
  const companyName = branding.companyName || 'Payment Portal';

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div
        className="absolute inset-0 z-0 bg-gray-800"
        style={{
          backgroundImage: "url('./pos-machine.jpg')",
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          filter: 'brightness(0.3)',
        }}
      />

      <div className="absolute lg:top-8 top-4 left-4 lg:left-8 z-20">
        <img
          src={displayLogo}
          className="h-10 lg:h-12 w-auto object-contain max-w-[200px]"
          alt={`${companyName} Logo`}
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = defaultLogo;
          }}
        />
      </div>

      <div className="relative z-10 flex items-center justify-center min-h-screen px-4 py-8">
        <div className="bg-[#cfeded] w-full max-w-4xl rounded-xl overflow-hidden shadow-2xl">
          <div className="bg-white flex flex-col md:flex-row h-full">
            <div className="hidden md:block md:w-1/2 relative">
              <video
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
              >
                <source src={PosVideo} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>

            <div className="w-full md:w-1/2 p-4 sm:p-6 md:p-8 bg-gray-100">
              <div className="max-w-md mx-auto pt-2 md:pt-6">
                <div className="flex flex-col items-center justify-center mb-4 md:mb-6">
                  {displayLogo ? (
                    <img
                      src={displayLogo}
                      alt={`${companyName} Logo`}
                      className="max-h-14 w-auto object-contain mb-3"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = defaultLogo;
                      }}
                    />
                  ) : (
                    <ArrowRight size={36} className="text-teal-600 mb-2" />
                  )}
                  {branding.companyName && !branding.isDefault && (
                    <span className="text-xs font-semibold tracking-wider text-teal-700 bg-teal-50 px-3 py-1 rounded-full uppercase">
                      {branding.companyName}
                    </span>
                  )}
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
