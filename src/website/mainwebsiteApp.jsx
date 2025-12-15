import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Phone, Mail, Star, CheckCircle, ArrowRight, Menu, X, Award, Users, Heart, Shield, Plus, Building2, Smile, Zap, DollarSign, Sparkles, Eye, Play, Image as ImageIcon, Facebook } from 'lucide-react';
import image1 from '../assets/image1.jpg';
import image2 from '../assets/image2.jpg';
import image3 from '../assets/image3.jpg';
import image4 from '../assets/Image4.png';
export default function ModernDentalWebsite() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('home');
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLoginClick = () => {
    window.location.href = '/auth'; // Navigate to login page
  };

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setActiveSection(sectionId);
      setIsMenuOpen(false);
    }
  };

  const services = [
    {
      title: "Teeth Cleaning",
      description: "Professional dental cleaning to remove plaque and tartar buildup",
    },
    {
      title: "Filling",
      description: "Tooth restoration to repair cavities and damaged teeth",
    },
    {
      title: "Tooth Extraction",
      description: "Safe and comfortable tooth removal procedures",
    },
    {
      title: "Crown / Bridge",
    description: "Dental caps to restore and protect damaged teeth",
    },
    {
      title: "Complete Denture",
    description: "Full set of replacement teeth for upper or lower jaw",
    },
    {
      title: "Orthodontics",
    description: "Braces and aligners to straighten teeth and correct bite",
    },
    {
      title: "Retainer",
    description: "Appliances to maintain teeth position after orthodontic treatment",
    },
    {
      title: "Partial Denture",
    description: "Removable replacement for some missing teeth",
    },
    {
      title: "Whitening",
    description: "Professional teeth bleaching for a brighter smile",
    },
    {
      title: "Veneers",
    description: "Thin shells placed over teeth to improve appearance",
    },
    {
      title: "Root Canal Therapy",
    description: "Treatment to save infected or damaged tooth pulp",
    },
    {
      title: "TMJ Therapy",
    description: "Treatment for jaw joint disorders and bite problems",
    },
    {
      title: "Denture Repair",
    description: "Fixing and maintenance of existing dentures",
    }
  ];

  const [expandedFaq, setExpandedFaq] = useState(null);

  const testimonials = [
    {
      name: "Maria Santos",
      rating: 5,
      text: "Excellent service! The staff is very professional and caring. Highly recommended!",
      date: "2 weeks ago"
    },
    {
      name: "Juan Dela Cruz",
      rating: 5,
      text: "Very clean clinic and the dentist is very gentle. I no longer fear going to the dentist!",
      date: "1 month ago"
    },
    {
      name: "Ana Rodriguez",
      rating: 5,
      text: "Affordable prices and quality service. The online booking system is very convenient!",
      date: "3 weeks ago"
    }
  ];

  const faqItems = [
    {
      question: "What should I bring to my first appointment?",
      answer: "Please bring a valid ID and any previous dental records or X-rays you may have. We'll also need insurance information if applicable. Our team will guide you through the rest of the process."
    },
    {
      question: "Is the clinic really clean and safe?",
      answer: "Yes! We follow strict sterilization protocols using modern equipment. All instruments are sterilized using state-of-the-art autoclave machines, and our clinic meets international health standards."
    },
    {
      question: "Do you offer payment plans?",
      answer: "Absolutely! We offer flexible payment options including installment plans for major procedures. Our staff can discuss options that work best for your budget."
    },
    {
      question: "How long does a typical appointment take?",
      answer: "Initial consultations take 30-45 minutes, while routine cleanings and checkups take 45-60 minutes. Depending on the procedure, it may take longer. We'll provide estimates during booking."
    },
    {
      question: "Is the dentist really gentle with anxious patients?",
      answer: "Our dentists are specially trained in handling dental anxiety. We use gentle techniques and can discuss sedation options if needed. Your comfort is our priority!"
    },
    {
      question: "Can I get results like the ones in testimonials?",
      answer: "Yes! Our experienced team provides personalized treatment plans based on your unique needs. Results vary by individual, but we're committed to helping you achieve your dental goals."
    }
  ];

  const trustBadges = [
    { icon: Building2, label: "Licensed Clinic", desc: "Certified by DOH" },
    { icon: Award, label: "Expert Dentists", desc: "10+ Years Experience" },
    { icon: Star, label: "5-Star Rated", desc: "200+ Patient Reviews" },
    { icon: Shield, label: "Guaranteed Safe", desc: "Sterilized Equipment" }
  ];

  const features = [
    { icon: Calendar, title: "Easy Online Booking", desc: "Schedule appointments 24/7" },
    { icon: Award, title: "Experienced Dentists", desc: "Licensed professionals" },
    { icon: Shield, title: "Sterilized Equipment", desc: "Your safety is our priority" },
    { icon: Heart, title: "Gentle Care", desc: "Comfortable treatments" }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-gray-100 shadow-lg' : 'bg-gray-100/95 backdrop-blur-sm'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg">
                <img src={image4} alt="Logo" className="w-12 h-12 object-contain" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-blue-900">Abeledo <span className="text-xl font-bold text-blue-900">Dental</span></h1>
                <p className="text-xs text-gray-500">Your Smile, Our Priority</p>
              </div>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-8">
              {['home', 'services', 'about', 'contact'].map((section) => (
                <button
                  key={section}
                  onClick={() => scrollToSection(section)}
                  className={`text-sm font-medium transition-colors capitalize ${
                    activeSection === section ? 'text-gray-800 font-semibold' : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  {section}
                </button>
              ))}
              <button 
                onClick={handleLoginClick}
                className="px-6 py-2.5 bg-gray-700 text-white rounded-lg font-medium hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl"
              >
                Login
              </button>
              <button 
                onClick={() => scrollToSection('booking')}
                className="px-6 py-2.5 bg-blue-900 text-white rounded-lg font-medium hover:bg-blue-800 transition-all shadow-lg shadow-blue-300 hover:shadow-xl"
              >
                Book Now
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-white border-t shadow-lg">
            <div className="px-4 py-6 space-y-4">
              {['home', 'services', 'about', 'contact'].map((section) => (
                <button
                  key={section}
                  onClick={() => scrollToSection(section)}
                  className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg capitalize"
                >
                  {section}
                </button>
              ))}
              <button 
                onClick={handleLoginClick}
                className="w-full px-6 py-3 bg-gray-700 text-white rounded-lg font-medium hover:bg-gray-800 mb-2"
              >
                Login
              </button>
              <button 
                onClick={() => scrollToSection('booking')}
                className="w-full px-6 py-3 bg-blue-900 text-white rounded-lg font-medium hover:bg-blue-800"
              >
                Book Appointment
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section id="home" className="pt-32 pb-20 px-4 bg-gradient-to-br from-gray-50 via-white to-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              
              <h1 className="text-5xl md:text-6xl font-bold text-gray-900 leading-tight">
                Your Smile
                <span className="block text-gray-700">Deserves the Best</span>
              </h1>
              <p className="text-xl text-gray-600 leading-relaxed">
                Quality dental care with a gentle touch. Experience modern dentistry in a comfortable and welcoming environment.
              </p>
              <div className="flex flex-wrap gap-4">
                <button 
                  onClick={() => scrollToSection('booking')}
                  className="px-8 py-4 bg-blue-900 text-white rounded-lg font-semibold hover:bg-blue-800 transition-all shadow-xl shadow-blue-300 hover:shadow-2xl flex items-center gap-2 group"
                >
                  Book Appointment
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </button>
                <button 
                  onClick={() => scrollToSection('services')}
                  className="px-8 py-4 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-800 transition-all shadow-lg"
                >
                  View Services
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-6 pt-8">
                <div>
                  <div className="text-3xl font-bold text-gray-700">10+</div>
                  <div className="text-sm text-gray-600">Years Experience</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-gray-700">5K+</div>
                  <div className="text-sm text-gray-600">Happy Patients</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-gray-700">98%</div>
                  <div className="text-sm text-gray-600">Satisfaction</div>
                </div>
              </div>
            </div>

            {/* Hero Image */}
            <div className="relative">
              <div className="aspect-square rounded-3xl bg-gradient-to-br from-gray-400 to-gray-600 shadow-2xl overflow-hidden border-4 border-white">
                <img 
                  src={image1}
                  alt="Dental Clinic Hero" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextElementSibling.style.display = 'flex';
                  }}
                />
                <div className="absolute inset-0 hidden items-center justify-center text-white text-9xl opacity-20">
                  🦷
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900/50 to-transparent" />
              </div>
              
              {/* Floating Cards */}
              <div className="absolute -bottom-6 -left-6 bg-white p-4 rounded-2xl shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="text-green-600" size={24} />
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">Verified</div>
                    <div className="text-sm text-gray-600">Licensed Clinic</div>
                  </div>
                </div>
              </div>

              <div className="absolute -top-6 -right-6 bg-white p-4 rounded-2xl shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                    <Star className="text-yellow-600" size={24} fill="currentColor" />
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">5.0 Rating</div>
                    <div className="text-sm text-gray-600">200+ Reviews</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            {features.map((feature, idx) => (
              <div key={idx} className="text-center group">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-gray-700 transition-colors border-2 border-gray-300">
                  <feature.icon className="text-gray-700 group-hover:text-white transition-colors" size={28} />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-600">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-20 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
           
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Comprehensive Dental Care
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              From routine checkups to specialized treatments, we've got your smile covered
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((service, idx) => (
              <div key={idx} className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all group hover:-translate-y-2 border-2 border-gray-200">
                <div className="text-5xl mb-4">{service.icon}</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{service.title}</h3>
                <p className="text-gray-600 mb-4 text-sm">{service.description}</p>
                <div className="flex items-center justify-between pt-4 border-t">
                  <div>
                    <div className="text-2xl font-bold text-gray-700">{service.price}</div>
                    <div className="text-xs text-gray-500">{service.duration}</div>
                  </div>
                  <button 
                    onClick={() => scrollToSection('booking')}
                    className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center group-hover:bg-blue-900 transition-colors border border-gray-300"
                  >
                    <ArrowRight className="text-gray-700 group-hover:text-white transition-colors" size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              What Our Patients Say
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, idx) => (
              <div key={idx} className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-8 shadow-lg border-2 border-gray-200 hover:shadow-xl transition-all hover:scale-105 duration-300">
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} size={20} className="text-yellow-400" fill="currentColor" />
                  ))}
                </div>
                <p className="text-gray-700 mb-6 italic">"{testimonial.text}"</p>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-900">{testimonial.name}</div>
                    <div className="text-sm text-gray-500">{testimonial.date}</div>
                  </div>
                  <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center text-gray-700 font-bold text-lg">
                    {testimonial.name[0]}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Badges Section */}
      <section className="py-16 px-4 bg-gradient-to-r from-gray-800 to-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            {trustBadges.map((badge, idx) => (
              <div key={idx} className="text-center text-white group">
                <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-3 group-hover:bg-blue-900 group-hover:scale-110 transition-all duration-300">
                  <badge.icon size={32} className="text-white" />
                </div>
                <h4 className="font-bold text-lg mb-1 group-hover:text-blue-300 transition-colors">{badge.label}</h4>
                <p className="text-sm text-gray-300">{badge.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
           
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-xl text-gray-600">
              Still have questions? Here are answers to help you feel confident about visiting us.
            </p>
          </div>

          <div className="space-y-4">
            {faqItems.map((item, idx) => (
              <div 
                key={idx}
                className="bg-white rounded-2xl border-2 border-gray-200 shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden"
              >
                <button
                  onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                  className="w-full px-8 py-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <h3 className="text-lg font-semibold text-gray-900 text-left">{item.question}</h3>
                  <div className={`text-blue-900 transition-transform duration-300 flex-shrink-0 ml-4 ${expandedFaq === idx ? 'rotate-45' : ''}`}>
                    <Plus size={24} />
                  </div>
                </button>
                {expandedFaq === idx && (
                  <div className="px-8 py-4 bg-gradient-to-b from-gray-50 to-white border-t-2 border-gray-200 animated-in fade-in">
                    <p className="text-gray-700 leading-relaxed">{item.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-12 bg-gradient-to-r from-blue-900 to-blue-800 rounded-2xl p-8 text-white text-center shadow-xl">
            <h3 className="text-2xl font-bold mb-2">Didn't find your answer?</h3>
            <p className="text-blue-200 mb-6">Our team is ready to help! Give us a call or book a consultation.</p>
            <button 
              onClick={handleLoginClick}
              className="px-8 py-3 bg-white text-blue-900 rounded-lg font-semibold hover:bg-blue-100 transition-all inline-flex items-center gap-2"
            >
              Contact Us Now <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 px-4 bg-gradient-to-br from-gray-700 to-gray-900 text-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>

              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                Excellence in Dental Care Since 2013
              </h2>
              <p className="text-gray-100 text-lg mb-6 leading-relaxed">
                At Abeledo Dental Clinic, we combine modern technology with compassionate care to provide exceptional dental services. Our team of experienced professionals is dedicated to making your visit comfortable and stress-free.
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle size={24} className="text-gray-300 flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="font-semibold mb-1">Licensed Professionals</h4>
                    <p className="text-gray-200 text-sm">Board-certified dentists with years of experience</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle size={24} className="text-gray-300 flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="font-semibold mb-1">Modern Equipment</h4>
                    <p className="text-gray-200 text-sm">State-of-the-art technology for precise treatments</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle size={24} className="text-gray-300 flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="font-semibold mb-1">Patient-Centered Care</h4>
                    <p className="text-gray-200 text-sm">Your comfort and satisfaction are our top priorities</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-square rounded-3xl bg-white/10 backdrop-blur-sm overflow-hidden border-4 border-white/20">
                <img 
                  src={image3}
                  alt="About Dental Clinic" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextElementSibling.style.display = 'flex';
                  }}
                />
                <div className="absolute inset-0 hidden items-center justify-center text-white text-9xl opacity-30">
                  👨‍⚕️
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact/Booking Section */}
      <section id="contact" className="py-20 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12">
            {/* Contact Info */}
            <div>
              <div className="inline-block px-4 py-2 bg-blue-900 text-blue-100 rounded-full text-sm font-medium mb-4">
                Get in Touch
              </div>
              <h2 className="text-4xl font-bold text-gray-900 mb-6">Visit Our Clinic</h2>
              <p className="text-gray-600 mb-8">
                We're here to answer your questions and schedule your appointment. Reach out to us today!
              </p>

              {/* Clinic Image */}
              <div className="mb-8 rounded-2xl overflow-hidden shadow-lg">
                <img 
                  src={image2}
                  alt="Dental Clinic Interior" 
                  className="w-full h-64 object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextElementSibling.style.display = 'flex';
                  }}
                />
                <div className="hidden w-full h-64 bg-gradient-to-br from-cyan-100 to-cyan-200 items-center justify-center">
                  <span className="text-6xl opacity-40">🏥</span>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-900 rounded-xl flex items-center justify-center flex-shrink-0">
                    <MapPin className="text-blue-100" size={24} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Address</h4>
                    <p className="text-gray-600">912 San Agustin St., Biwas 4108 Tanza, Philippines</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-900 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Phone className="text-blue-100" size={24} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Phone</h4>
                    <p className="text-gray-600">+63 929 260 2170</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-900 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Mail className="text-blue-100" size={24} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Email</h4>
                    <p className="text-gray-600">info@abeledodental.com</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-900 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Clock className="text-blue-100" size={24} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Hours</h4>
                    <p className="text-gray-600">Mon-Sat: 10:00 AM - 5:00 PM</p>
                    <p className="text-gray-600">Sunday: Closed</p>
                  </div>
                </div>

                {/* Facebook Contact */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-900 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Facebook className="text-blue-100" size={24} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Facebook</h4>
                    <a
                      href="https://www.facebook.com/profile.php?id=100063856181852"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-700 hover:underline font-medium"
                    >
                      Abeledo Dental
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Booking CTA */}
            <div id="booking" className="bg-gradient-to-br from-blue-900 to-blue-800 rounded-3xl p-8 md:p-12 text-white shadow-2xl">
              <h3 className="text-3xl font-bold mb-4">Ready to Book?</h3>
              <p className="text-blue-100 mb-8">
                Schedule your appointment online and experience quality dental care with convenience.
              </p>

              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-3">
                  <CheckCircle size={24} className="text-blue-300" />
                  <span>Easy online booking system</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle size={24} className="text-blue-300" />
                  <span>Flexible appointment times</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle size={24} className="text-blue-300" />
                  <span>Instant confirmation</span>
                </div>
              </div>

              <button 
                onClick={handleLoginClick}
                className="w-full px-8 py-4 bg-white text-cyan-700 rounded-full font-bold hover:bg-cyan-50 transition-all shadow-xl flex items-center justify-center gap-2 group"
              >
                Book Your Appointment Now
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>

              <p className="text-center text-blue-200 text-sm mt-4">
                No credit card required • Cancel anytime
              </p>

              {/* Google Maps Location */}
              <div className="mt-8 rounded-2xl overflow-hidden shadow-lg">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3864.4900268456317!2d120.85242467587217!3d14.398892081981765!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x33962c8b79cafa37%3A0x9faf766492671c1d!2s912%20San%20Agustin%2C%20Tanza%2C%20Cavite!5e0!3m2!1sen!2sph!4v1765206703714!5m2!1sen!2sph"
                  width="100%"
                  height="350"
                  style={{ border: 0 }}
                  allowFullScreen=""
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Abeledo Dental Location"
                ></iframe>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center">
                  <img src={image4} alt="Logo" className="w-12 h-12 object-contain" />
                </div>
                <div className="font-bold text-lg">Abeledo Dental</div>
              </div>
              <p className="text-gray-400 text-sm">
                Your trusted partner in dental health and beautiful smiles.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <div className="space-y-2 text-sm">
                <button onClick={() => scrollToSection('home')} className="block text-gray-400 hover:text-white">Home</button>
                <button onClick={() => scrollToSection('services')} className="block text-gray-400 hover:text-white">Services</button>
                <button onClick={() => scrollToSection('about')} className="block text-gray-400 hover:text-white">About</button>
                <button onClick={() => scrollToSection('contact')} className="block text-gray-400 hover:text-white">Contact</button>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Contact</h4>
              <div className="space-y-2 text-sm text-gray-400">
                <div>912 San Agustin St., Biwas 4108 Tanza, Philippines</div>
                <div>+63 929 260 2170</div>
                <div>info@abeledodental.com</div>
              </div>
            </div>

            {/* Facebook Footer Icon */}
            <div className="flex flex-col items-start">
              <h4 className="font-semibold mb-4">Follow Us</h4>
              <a
                href="https://www.facebook.com/profile.php?id=100063856181852"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-600"
                aria-label="Facebook Page"
              >
                <Facebook size={28} />
                <span className="font-medium">Facebook</span>
              </a>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 text-center text-sm text-gray-400">
            <p>© 2025 Abeledo Dental Clinic. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Floating Action Button */}
      <button
        onClick={() => scrollToSection('booking')}
        className="fixed bottom-8 right-8 w-16 h-16 bg-red-600 text-white rounded-full shadow-2xl hover:bg-red-700 transition-all flex items-center justify-center group z-40"
      >
        <Calendar size={28} className="group-hover:scale-110 transition-transform" />
      </button>
    </div>
  );
}