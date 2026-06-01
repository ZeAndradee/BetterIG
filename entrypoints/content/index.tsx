import ReactDOM from 'react-dom/client';
import { VideoControls } from '@/components/VideoControls/VideoControls';

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
        root.render(<VideoControls />);
        return root;
      },
      onRemove(root) {
        root?.unmount();
      },
    });

    ui.mount();
  },
});
