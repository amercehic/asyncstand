import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
// import { ModernButton } from '@/components/ui'; // Removed - not used after UI refactor
import { SuperAdminRoute } from '@/components/SuperAdminRoute';

const AdminPageContent: React.FC = () => {
  const navigate = useNavigate();

  const adminSections = [
    {
      title: 'Feature Flags',
      description: 'Manage feature flags and organization overrides',
      icon: Shield,
      path: '/admin/features',
      color: 'from-blue-500 to-blue-600',
      hoverColor: 'hover:from-blue-600 hover:to-blue-700',
    },
  ];

  const handleSectionClick = (section: (typeof adminSections)[0]) => {
    navigate(section.path);
  };

  return (
    <div className="container mx-auto px-6 py-8 max-w-6xl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Administration</h1>
            <p className="text-muted-foreground">System administration and management tools</p>
          </div>
        </div>
      </motion.div>

      {/* Admin Sections */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex justify-center"
      >
        {adminSections.map((section, index) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * index }}
            className="group relative overflow-hidden bg-card rounded-xl border border-border shadow-sm hover:shadow-lg hover:border-primary/20 transition-all duration-300 cursor-pointer w-full max-w-md transform hover:-translate-y-1"
            onClick={() => handleSectionClick(section)}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div
                  className={`p-3 bg-gradient-to-r ${section.color} rounded-lg transition-all duration-300 ${section.hoverColor}`}
                >
                  <section.icon className="h-6 w-6 text-white" />
                </div>
              </div>

              <h3 className="text-xl font-semibold text-foreground mb-2">{section.title}</h3>
              <p className="text-muted-foreground text-sm mb-4">{section.description}</p>

              <div className="flex items-center gap-2 text-primary font-medium">
                <span className="text-sm">Access {section.title}</span>
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </div>
            </div>

            {/* Decorative gradient overlay */}
            <div
              className={`absolute inset-0 bg-gradient-to-r ${section.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300 pointer-events-none`}
            />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
};

export const AdminPage: React.FC = () => {
  return (
    <SuperAdminRoute>
      <AdminPageContent />
    </SuperAdminRoute>
  );
};

AdminPage.displayName = 'AdminPage';

export default AdminPage;
