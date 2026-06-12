// DOM overlay HUD. Buttons and counters are miserable in Pixi and free in DOM.

export class Hud {
  private top = document.getElementById('hud-top')!;
  private debug = document.getElementById('hud-debug')!;
  private messages = document.getElementById('hud-messages')!;

  setTopBar(html: string): void {
    this.top.innerHTML = html;
  }

  setDebug(text: string): void {
    this.debug.textContent = text;
  }

  showMessage(text: string, ms = 3000): void {
    const el = document.createElement('div');
    el.className = 'hud-message';
    el.textContent = text;
    this.messages.appendChild(el);
    setTimeout(() => el.remove(), ms);
  }
}
