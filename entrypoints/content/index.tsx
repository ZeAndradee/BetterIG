import ReactDOM from 'react-dom/client';
import { VideoControls } from '@/components/VideoControls/VideoControls';
import { WelcomeModal } from '@/components/WelcomeModal/WelcomeModal';
import { useFlags, useWelcomePending, dismissWelcome } from '@/utils/store';
import './globals.css';

function App() {
  const flags = useFlags();
  const welcome = useWelcomePending();
  return (
    <>
      {(flags.video || flags.stories) && (
        <VideoControls videoEnabled={flags.video} storiesEnabled={flags.stories} />
      )}
      {welcome && <WelcomeModal onClose={dismissWelcome} />}
    </>
  );
}

export default defineContentScript({
  matches: ['https://*.instagram.com/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: 'ig-video-control-bar',
      position: 'overlay',
      anchor: 'body',
      onMount(container) {
        const root = ReactDOM.createRoot(container);
        root.render(<App />);
        return root;
      },
      onRemove(root) {
        root?.unmount();
      },
    });

    ui.mount();
  },
});
