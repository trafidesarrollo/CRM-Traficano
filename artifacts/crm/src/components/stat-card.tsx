import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  description?: string;
  delay?: number;
}

export function StatCard({ title, value, icon, description, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Card className="bg-card/50 backdrop-blur-sm border-white/5 shadow-xl hover:border-primary/20 transition-all duration-300">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <h3 className="text-3xl font-display font-bold mt-2 text-foreground">{value}</h3>
              {description && (
                <p className="text-xs text-muted-foreground mt-1">{description}</p>
              )}
            </div>
            <div className="p-4 rounded-2xl bg-primary/10 text-primary">
              {icon}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
