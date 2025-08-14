import React, { createContext, useContext, useState } from "react";

type ViewState =
  | { name: "dashboard" }
  | { name: "sandbox"; params: { id: string } }
  | { name: "debug"; params: { id: string } };

export const ViewContext = createContext<{
  view: ViewState;
  setView: (view: ViewState) => void;
}>({
  view: { name: "dashboard" },
  setView: () => {},
});

export const ViewProvider = ({ children }: { children: React.ReactNode }) => {
  const [view, setView] = useState<ViewState>({
    name: "dashboard",
  });

  return (
    <ViewContext.Provider value={{ view, setView }}>
      {children}
    </ViewContext.Provider>
  );
};

export const useView = <T extends ViewState["name"]>() => {
  const { view, setView } = useContext(ViewContext);
  const typedView = view as Extract<ViewState, { name: T }>;

  return {
    view: typedView,
    setView,
  };
};
