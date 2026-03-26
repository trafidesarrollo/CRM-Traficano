import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center text-center p-4">
      <h1 className="text-8xl font-display font-bold text-primary mb-4">404</h1>
      <h2 className="text-2xl font-bold text-foreground mb-4">Página no encontrada</h2>
      <p className="text-muted-foreground mb-8 max-w-md">
        Lo sentimos, la página que buscas no existe o ha sido movida.
      </p>
      <Link href="/">
        <Button className="bg-primary text-white px-8 rounded-xl h-12">
          Volver al Inicio
        </Button>
      </Link>
    </div>
  );
}
