import type { Messages } from "./messages";

/** Spanish catalog (OG-099, ADR-0009); must cover every key of `en`. */
export const es: Messages = {
  app: {
    couldNotSetTitle: "No se pudo establecer el título de la ventana: {error}",
    refreshed: "Actualizado {name}",
    pushConfirm: "¿Hacer push de {branch} al remoto?",
  },
  workspace: {
    title: "Espacio de trabajo",
    status: "Estado de archivos",
    history: "Historial",
    diff: "Diff",
    conflicts: "Conflictos",
    conflictsCount: "Conflictos ({count})",
    search: "Buscar",
    reflog: "Reflog",
  },
  sidebar: {
    repository: "Repositorio",
    resize: "Redimensionar barra lateral",
  },
  content: {
    history: "Historial",
  },
  output: {
    title: "Salida",
    resize: "Redimensionar salida",
  },
  settings: {
    language: "Idioma",
    languageSystem: "Idioma del sistema",
    languageEnglish: "Inglés",
    languageSpanish: "Español",
  },
  welcome: {
    title: "Ningún repositorio abierto",
    subtitle: "Abre un repositorio para ver su grafo de commits e historial.",
    chooseFolder: "Elegir carpeta",
    clone: "Clonar repositorio…",
    create: "Crear repositorio…",
    recents: "Proyectos recientes",
    recentsAria: "Proyectos recientes",
    removeRecent: "Quitar {name} de proyectos recientes",
    remove: "Quitar {name}",
  },
  tabs: {
    aria: "Repositorios abiertos",
    close: "Cerrar {name}",
    openAnother: "Abrir otro repositorio",
    openInNewWindow: "Abrir en una ventana nueva",
  },
  toolbar: {
    noRepo: "Ningún repositorio abierto",
    commit: "Commit",
    pull: "Pull",
    push: "Push",
    fetch: "Fetch",
    branch: "Rama",
    merge: "Merge",
    merging: "Fusionando…",
    stash: "Stash",
    refresh: "Actualizar",
    refreshing: "Actualizando…",
    open: "Abrir",
    opening: "Abriendo…",
    viewRemote: "Ver remoto",
    showInFinder: "Mostrar en Finder",
    terminal: "Terminal",
    settings: "Ajustes",
  },
};
