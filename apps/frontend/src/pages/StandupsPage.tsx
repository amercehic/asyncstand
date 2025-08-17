import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, Users, Clock } from 'lucide-react';

export const StandupsPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6"
        >
          <div>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="relative mb-2"
            >
              <motion.h1
                className="text-2xl sm:text-4xl font-bold text-foreground relative z-10"
                initial={{ y: 10 }}
                animate={{ y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
              >
                <span className="relative inline-block">
                  <span className="bg-gradient-to-r from-foreground via-purple-600/80 to-foreground bg-clip-text text-transparent font-extrabold">
                    Standups
                  </span>

                  {/* Standup activity effects */}
                  <motion.div
                    className="absolute -top-2 -right-8 flex space-x-1"
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 1 }}
                  >
                    <motion.div
                      className="w-2 h-2 bg-purple-400 rounded-full"
                      animate={{ y: [0, -4, 0] }}
                      transition={{
                        duration: 1.5,
                        delay: 1.2,
                        repeat: Infinity,
                        repeatDelay: 2,
                      }}
                    />
                    <motion.div
                      className="w-2 h-2 bg-primary rounded-full"
                      animate={{ y: [0, -4, 0] }}
                      transition={{
                        duration: 1.5,
                        delay: 1.4,
                        repeat: Infinity,
                        repeatDelay: 2,
                      }}
                    />
                    <motion.div
                      className="w-2 h-2 bg-purple-300 rounded-full"
                      animate={{ y: [0, -4, 0] }}
                      transition={{
                        duration: 1.5,
                        delay: 1.6,
                        repeat: Infinity,
                        repeatDelay: 2,
                      }}
                    />
                  </motion.div>
                </span>
              </motion.h1>
            </motion.div>

            <motion.p
              className="text-base sm:text-lg text-muted-foreground"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              Manage your team's daily standups and schedules
            </motion.p>
          </div>
        </motion.div>

        {/* Coming Soon Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="bg-card border border-border rounded-xl p-8 text-center"
        >
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Standup Management Coming Soon!</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            We're working on powerful standup scheduling and management features. Soon you'll be
            able to:
          </p>

          <div className="grid md:grid-cols-3 gap-4 max-w-2xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="bg-muted/30 rounded-lg p-4"
            >
              <Clock className="w-6 h-6 text-primary mx-auto mb-2" />
              <h3 className="font-medium mb-1">Schedule Standups</h3>
              <p className="text-sm text-muted-foreground">
                Set recurring daily standups for your teams
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="bg-muted/30 rounded-lg p-4"
            >
              <Users className="w-6 h-6 text-primary mx-auto mb-2" />
              <h3 className="font-medium mb-1">Team Participation</h3>
              <p className="text-sm text-muted-foreground">Track attendance and responses</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.7 }}
              className="bg-muted/30 rounded-lg p-4"
            >
              <Calendar className="w-6 h-6 text-primary mx-auto mb-2" />
              <h3 className="font-medium mb-1">History & Analytics</h3>
              <p className="text-sm text-muted-foreground">Review past standups and insights</p>
            </motion.div>
          </div>
        </motion.div>
      </main>
    </div>
  );
};
