import type { Locale } from '../i18n/locales.ts';
import type { DisplayMessageData } from './display-message-data.ts';
import { ASPIRATIONAL_MESSAGES, MOTIVATIONAL_MESSAGES } from './display-message-data.ts';

function pulse(id: string, text: string): DisplayMessageData {
  return { id, text, author: null };
}

const ES_MOTIVATION: DisplayMessageData[] = [
  pulse('es-motivation-001', 'Respirá. El próximo esfuerzo empieza con una buena recuperación.'),
  pulse('es-motivation-002', 'No necesitás sentirte listo; necesitás estar presente.'),
  pulse('es-motivation-003', 'Cada ronda terminada le da confianza a la siguiente.'),
  pulse('es-motivation-004', 'Aflojá la tensión y conservá la intención.'),
  pulse('es-motivation-005', 'Tu ritmo puede cambiar sin que cambie tu compromiso.'),
  pulse('es-motivation-006', 'Este descanso también forma parte del trabajo.'),
  pulse('es-motivation-007', 'Volvé a tu respiración y prepará una ronda limpia.'),
  pulse('es-motivation-008', 'No persigas la ronda anterior. Construí la que viene.'),
  pulse('es-motivation-009', 'La constancia se nota cuando elegís volver a empezar.'),
  pulse('es-motivation-010', 'Soltá lo que salió mal; llevate lo que aprendiste.'),
  pulse('es-motivation-011', 'La próxima repetición sólo pide tu atención completa.'),
  pulse('es-motivation-012', 'Recuperá con calma para trabajar con decisión.'),
  pulse('es-motivation-013', 'El cansancio habla fuerte; tu intención puede hablar más claro.'),
  pulse('es-motivation-014', 'Un esfuerzo honesto alcanza para seguir avanzando.'),
  pulse('es-motivation-015', 'Bajá los hombros. Ordená el aire. Volvé al centro.'),
  pulse('es-motivation-016', 'No hace falta apurarse para sostener el impulso.'),
  pulse('es-motivation-017', 'Tu trabajo ahora es recuperar lo suficiente para volver bien.'),
  pulse('es-motivation-018', 'La mejora también vive en estos segundos silenciosos.'),
  pulse('es-motivation-019', 'Elegí una cosa simple para hacer bien en la próxima ronda.'),
  pulse('es-motivation-020', 'Seguir no siempre es acelerar; a veces es respirar y volver.'),
  pulse('es-motivation-021', 'Ya hiciste una parte difícil: estar acá.'),
  pulse('es-motivation-022', 'Recuperá sin culpa. La energía bien usada vuelve.'),
  pulse('es-motivation-023', 'Dejá que el descanso acomode lo que el esfuerzo construyó.'),
  pulse('es-motivation-024', 'La próxima ronda no necesita perfección; necesita presencia.'),
];

const ES_ASPIRATION: DisplayMessageData[] = [
  pulse('es-aspiration-001', 'Dejá que la respiración encuentre su propio ritmo. El esfuerzo terminó y ahora empieza la recuperación.'),
  pulse('es-aspiration-002', 'Reconocé el momento en que quisiste aflojar y elegiste continuar. Esa decisión también es progreso.'),
  pulse('es-aspiration-003', 'Soltá los hombros y las manos. Podés dejar ir la tensión sin perder lo que construiste.'),
  pulse('es-aspiration-004', 'Antes de evaluar el entrenamiento, dale crédito al esfuerzo que acabás de completar.'),
  pulse('es-aspiration-005', 'No necesitabas una sesión perfecta. Estar presente y terminar fue suficiente para hoy.'),
  pulse('es-aspiration-006', 'Observá qué te ayudó a sostenerte. Esa respuesta puede acompañarte en el próximo entrenamiento.'),
  pulse('es-aspiration-007', 'El cuerpo está bajando el ritmo. Acompañalo con paciencia y dejá que el trabajo se asiente.'),
  pulse('es-aspiration-008', 'Tu progreso no vive sólo en los números; también está en el control, la paciencia y la constancia.'),
  pulse('es-aspiration-009', 'El entrenamiento pidió algo de vos y respondiste. Permitite reconocerlo mientras recuperás el aire.'),
  pulse('es-aspiration-010', 'Guardá una lección simple de esta sesión y soltá todo lo demás por ahora.'),
  pulse('es-aspiration-011', 'Sentí cómo vuelve la calma. Terminar con intención también es parte de entrenar bien.'),
  pulse('es-aspiration-012', 'Agradecé la decisión que te hizo empezar. La sostuviste hasta este último momento.'),
  pulse('es-aspiration-013', 'La parte más exigente quedó atrás. Respirá cómodo y dejá que aparezca la satisfacción.'),
  pulse('es-aspiration-014', 'Cerrá la sesión presente y estable. Mañana vas a construir desde lo que hiciste hoy.'),
];

const PT_MOTIVATION: DisplayMessageData[] = [
  pulse('pt-motivation-001', 'Respire. O próximo esforço começa com uma boa recuperação.'),
  pulse('pt-motivation-002', 'Você não precisa se sentir pronto; precisa estar presente.'),
  pulse('pt-motivation-003', 'Cada rodada concluída dá confiança à próxima.'),
  pulse('pt-motivation-004', 'Solte a tensão e preserve a intenção.'),
  pulse('pt-motivation-005', 'Seu ritmo pode mudar sem mudar seu compromisso.'),
  pulse('pt-motivation-006', 'Este descanso também faz parte do trabalho.'),
  pulse('pt-motivation-007', 'Volte à respiração e prepare uma rodada limpa.'),
  pulse('pt-motivation-008', 'Não persiga a rodada anterior. Construa a próxima.'),
  pulse('pt-motivation-009', 'A consistência aparece quando você escolhe recomeçar.'),
  pulse('pt-motivation-010', 'Solte o que deu errado e leve o que aprendeu.'),
  pulse('pt-motivation-011', 'A próxima repetição só pede sua atenção completa.'),
  pulse('pt-motivation-012', 'Recupere-se com calma para trabalhar com decisão.'),
  pulse('pt-motivation-013', 'O cansaço fala alto; sua intenção pode falar mais claro.'),
  pulse('pt-motivation-014', 'Um esforço honesto basta para continuar avançando.'),
  pulse('pt-motivation-015', 'Relaxe os ombros. Organize o ar. Volte ao centro.'),
  pulse('pt-motivation-016', 'Você não precisa ter pressa para manter o impulso.'),
  pulse('pt-motivation-017', 'Seu trabalho agora é recuperar o suficiente para voltar bem.'),
  pulse('pt-motivation-018', 'A melhora também vive nestes segundos silenciosos.'),
  pulse('pt-motivation-019', 'Escolha uma coisa simples para fazer bem na próxima rodada.'),
  pulse('pt-motivation-020', 'Continuar nem sempre é acelerar; às vezes é respirar e voltar.'),
  pulse('pt-motivation-021', 'Você já fez uma parte difícil: estar aqui.'),
  pulse('pt-motivation-022', 'Recupere-se sem culpa. A energia bem usada retorna.'),
  pulse('pt-motivation-023', 'Deixe o descanso organizar o que o esforço construiu.'),
  pulse('pt-motivation-024', 'A próxima rodada não precisa de perfeição; precisa de presença.'),
];

const PT_ASPIRATION: DisplayMessageData[] = [
  pulse('pt-aspiration-001', 'Deixe a respiração encontrar o próprio ritmo. O esforço terminou e agora começa a recuperação.'),
  pulse('pt-aspiration-002', 'Reconheça o momento em que quis reduzir o ritmo e escolheu continuar. Essa decisão também é progresso.'),
  pulse('pt-aspiration-003', 'Relaxe os ombros e as mãos. Você pode soltar a tensão sem perder o que construiu.'),
  pulse('pt-aspiration-004', 'Antes de avaliar o treino, reconheça o esforço que acabou de concluir.'),
  pulse('pt-aspiration-005', 'Você não precisava de uma sessão perfeita. Estar presente e terminar foi suficiente hoje.'),
  pulse('pt-aspiration-006', 'Observe o que ajudou você a continuar. Essa resposta pode acompanhar o próximo treino.'),
  pulse('pt-aspiration-007', 'O corpo está reduzindo o ritmo. Acompanhe com paciência e deixe o trabalho se acomodar.'),
  pulse('pt-aspiration-008', 'Seu progresso não vive apenas nos números; ele também está no controle, na paciência e na consistência.'),
  pulse('pt-aspiration-009', 'O treino pediu algo de você, e você respondeu. Reconheça isso enquanto recupera o fôlego.'),
  pulse('pt-aspiration-010', 'Guarde uma lição simples desta sessão e deixe todo o resto para depois.'),
  pulse('pt-aspiration-011', 'Sinta a calma voltar. Terminar com intenção também faz parte de treinar bem.'),
  pulse('pt-aspiration-012', 'Agradeça à decisão que fez você começar. Você a sustentou até este último momento.'),
  pulse('pt-aspiration-013', 'A parte mais exigente ficou para trás. Respire com conforto e permita que a satisfação apareça.'),
  pulse('pt-aspiration-014', 'Encerre a sessão presente e estável. Amanhã você vai construir a partir do que fez hoje.'),
];

export type LocalizedDisplayMessages = {
  motivation: DisplayMessageData[];
  aspiration: DisplayMessageData[];
};

const DISPLAY_MESSAGES: Record<Locale, LocalizedDisplayMessages> = {
  en: { motivation: MOTIVATIONAL_MESSAGES, aspiration: ASPIRATIONAL_MESSAGES },
  'es-AR': { motivation: ES_MOTIVATION, aspiration: ES_ASPIRATION },
  'pt-BR': { motivation: PT_MOTIVATION, aspiration: PT_ASPIRATION },
};

export function displayMessagesForLocale(locale: Locale) {
  return DISPLAY_MESSAGES[locale];
}
