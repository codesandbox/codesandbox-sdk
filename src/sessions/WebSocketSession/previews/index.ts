import { Disposable } from "../../../utils/disposable";
import { Preview } from "./Preview";

export { Preview } from "./Preview";

export class Previews {
  private disposable = new Disposable();
  constructor(private sessionDisposable: Disposable) {
    sessionDisposable.onWillDispose(() => {
      this.disposable.dispose();
    });
  }
  create(src: string) {
    return new Preview(this.sessionDisposable, src);
  }
}
