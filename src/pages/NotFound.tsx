import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { UrnIllustration } from '@/components/brand/Brand';

const NotFound = () => (
  <div className="min-h-screen grid place-items-center bg-background p-6 text-center">
    <div>
      <UrnIllustration className="w-32 mx-auto opacity-80" />
      <h1 className="font-display text-4xl font-bold mt-6">Página não encontrada</h1>
      <p className="text-muted-foreground mt-2">Este endereço não existe — diferente dos bens, que a gente sempre encontra.</p>
      <Button asChild className="mt-6"><Link to="/painel">Voltar ao painel</Link></Button>
    </div>
  </div>
);

export default NotFound;
