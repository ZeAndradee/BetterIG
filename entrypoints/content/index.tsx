import ReactDOM from 'react-dom/client';
import { VideoControls } from '@/components/VideoControls/VideoControls';
import { useFlags } from '@/utils/store';
import './globals.css';

function App() {
  const flags = useFlags();
  if (!flags.video && !flags.stories) return null;
  return <VideoControls videoEnabled={flags.video} storiesEnabled={flags.stories} />;
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
