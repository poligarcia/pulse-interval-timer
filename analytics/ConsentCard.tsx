'use client';

import { useId } from 'react';
import type { Locale } from '../i18n/locales.ts';
import type { Consent, ConsentChoice } from './consent.ts';

const messages = {
  'es-AR': {
    privacy: 'Privacidad', title: 'Cookies de estadísticas',
    body: 'Si aceptás, usamos cookies para medir el uso de Laptiva y mejorar la app. Sin fines publicitarios.',
    reject: 'Rechazar', accept: 'Aceptar', more: 'Más sobre privacidad',
    accepted: 'Estadísticas activadas', rejected: 'Estadísticas desactivadas', unknown: 'Todavía no elegiste',
    disable: 'Desactivar estadísticas', enable: 'Activar estadísticas',
    details: 'Usamos Google Analytics, a través de Firebase, para conocer qué pantallas y funciones se usan y detectar problemas. Google recibe identificadores de cookies y de la instalación web, además de datos técnicos del dispositivo y navegador. No enviamos nombres de timers, texto libre, historial guardado ni contenido de Labs.',
    retention: 'Las cookies de estadísticas duran hasta 180 días. Configuramos dos meses de conservación para datos detallados de usuario y eventos en Analytics, sin reiniciar el plazo con cada visita. Los reportes agregados pueden conservarse por más tiempo.',
    control: 'La app funciona igual si rechazás. Guardamos tu elección en este navegador durante 180 días. Podés cambiarla en Ajustes → Privacidad. Al desactivar, detenemos nuevos envíos y borramos las cookies de estadísticas de Laptiva; tu historial local no se borra. Esto no elimina datos ya enviados a Google.',
    google: 'Cómo usa Google los datos',
    error: 'No pudimos guardar tu elección. Las estadísticas siguen desactivadas en esta pestaña. Revisá los permisos de almacenamiento del navegador e intentá de nuevo.',
  },
  en: {
    privacy: 'Privacy', title: 'Analytics cookies',
    body: 'If you accept, we use cookies to measure how Laptiva is used and improve the app. Not for advertising.',
    reject: 'Reject', accept: 'Accept', more: 'More about privacy',
    accepted: 'Analytics enabled', rejected: 'Analytics disabled', unknown: 'No choice yet',
    disable: 'Disable analytics', enable: 'Enable analytics',
    details: 'We use Google Analytics, through Firebase, to understand which screens and features are used and identify problems. Google receives cookie and web installation identifiers, plus technical device and browser data. We do not send timer names, free text, saved history or Labs content.',
    retention: 'Analytics cookies last up to 180 days. We configure two months of retention for detailed user and event data in Analytics, without resetting the period on each visit. Aggregated reports may be kept longer.',
    control: 'The app works the same if you reject. We remember your choice in this browser for 180 days. You can change it in Settings → Privacy. Disabling stops new analytics and deletes Laptiva analytics cookies; your local history is not deleted. This does not delete data already sent to Google.',
    google: 'How Google uses data',
    error: 'We could not save your choice. Analytics remains disabled in this tab. Check your browser storage permissions and try again.',
  },
  'pt-BR': {
    privacy: 'Privacidade', title: 'Cookies de estatísticas',
    body: 'Se você aceitar, usamos cookies para medir o uso do Laptiva e melhorar o app. Sem fins publicitários.',
    reject: 'Rejeitar', accept: 'Aceitar', more: 'Mais sobre privacidade',
    accepted: 'Estatísticas ativadas', rejected: 'Estatísticas desativadas', unknown: 'Você ainda não escolheu',
    disable: 'Desativar estatísticas', enable: 'Ativar estatísticas',
    details: 'Usamos o Google Analytics, por meio do Firebase, para entender quais telas e recursos são usados e identificar problemas. O Google recebe identificadores de cookies e da instalação web, além de dados técnicos do dispositivo e navegador. Não enviamos nomes de timers, texto livre, histórico salvo ou conteúdo do Labs.',
    retention: 'Os cookies de estatísticas duram até 180 dias. Configuramos dois meses de retenção para dados detalhados de usuários e eventos no Analytics, sem reiniciar o prazo a cada visita. Relatórios agregados podem ser mantidos por mais tempo.',
    control: 'O app funciona da mesma forma se você rejeitar. Guardamos sua escolha neste navegador por 180 dias. Você pode alterá-la em Ajustes → Privacidade. Ao desativar, interrompemos novos envios e apagamos os cookies de estatísticas do Laptiva; seu histórico local não é apagado. Isso não exclui dados já enviados ao Google.',
    google: 'Como o Google usa os dados',
    error: 'Não foi possível salvar sua escolha. As estatísticas continuam desativadas nesta aba. Verifique as permissões de armazenamento do navegador e tente novamente.',
  },
};

export function ConsentCard({ locale, consent, choose, storageError, settings = false }: {
  locale: Locale; consent: Consent; choose: (choice: ConsentChoice) => void; storageError: boolean; settings?: boolean;
}) {
  const copy = messages[locale];
  const titleId = useId();
  return <section className={`analytics-consent${settings ? ' analytics-privacy-settings' : ''}`} aria-labelledby={titleId}>
    {settings && <p className="settings-kicker">{copy.privacy}</p>}
    <h2 id={titleId}>{copy.title}</h2>
    <p>{copy.body}</p>
    {settings && <p className="analytics-consent-status" role="status">{copy[consent]}</p>}
    <div className="analytics-consent-actions">
      <button type="button" onClick={() => choose('rejected')} disabled={settings && consent === 'rejected'}>{settings ? copy.disable : copy.reject}</button>
      <button type="button" onClick={() => choose('accepted')} disabled={settings && consent === 'accepted'}>{settings ? copy.enable : copy.accept}</button>
    </div>
    {storageError && <p role="alert">{copy.error}</p>}
    <details>
      <summary>{copy.more}</summary>
      <p>{copy.details}</p>
      <p>{copy.retention}</p>
      <p>{copy.control}</p>
      <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer">{copy.google} ↗</a>
    </details>
  </section>;
}
