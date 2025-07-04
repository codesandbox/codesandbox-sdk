import React, { createContext, useContext, useState } from "react";

type View = "dashboard" | "sandbox";

interface ViewState {
  name: View;
  params?: Record<string, string>;
}

export const ViewContext = createContext<{
  view: ViewState;
  setView: (view: ViewState) => void;
}>({
  view: { name: "dashboard" },
  setView: () => {},
});

export const ViewProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [view, setView] = useState<ViewState>({
    name: 'dashboard'
  });

  const handleSetView = (view: View | ViewState) => {
    if (typeof view === "string") {
      setView({ name: view });
    } else {
      setView(view);
    }
  }

  return (
    <ViewContext.Provider value={{ view, setView: handleSetView }}>
      {children}
    </ViewContext.Provider>
  );
};

export const useView = () => {
  return useContext(ViewContext);
};
