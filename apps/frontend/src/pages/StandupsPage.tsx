import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, Users, Clock } from 'lucide-react';

export const StandupsPage = () => {
  return (
    <div className="container mx-auto px-6 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-8"
      >
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-card-foreground">Standups</h1>
          <p className="text-muted-foreground mt-2">
            Manage your team's daily standups and schedules
          </p>
        </div>

        {/* Coming Soon Content */}
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Standup Management Coming Soon!</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            We're working on powerful standup scheduling and management features. Soon you'll be
            able to:
          </p>

          <div className="grid md:grid-cols-3 gap-4 max-w-2xl mx-auto">
            <div className="bg-muted/30 rounded-lg p-4">
              <Clock className="w-6 h-6 text-primary mx-auto mb-2" />
              <h3 className="font-medium mb-1">Schedule Standups</h3>
              <p className="text-sm text-muted-foreground">
                Set recurring daily standups for your teams
              </p>
            </div>

            <div className="bg-muted/30 rounded-lg p-4">
              <Users className="w-6 h-6 text-primary mx-auto mb-2" />
              <h3 className="font-medium mb-1">Team Participation</h3>
              <p className="text-sm text-muted-foreground">Track attendance and responses</p>
            </div>

            <div className="bg-muted/30 rounded-lg p-4">
              <Calendar className="w-6 h-6 text-primary mx-auto mb-2" />
              <h3 className="font-medium mb-1">History & Analytics</h3>
              <p className="text-sm text-muted-foreground">Review past standups and insights</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
