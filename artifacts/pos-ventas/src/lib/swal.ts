import Swal from "sweetalert2";

export const Toast = Swal.mixin({
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timer: 2500,
  timerProgressBar: true,
  customClass: { popup: "!rounded-xl !text-sm !font-medium" },
});

export const confirmDelete = (entity = "este elemento") =>
  Swal.fire({
    title: "¿Confirmar eliminación?",
    text: `${entity} será eliminado permanentemente.`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    cancelButtonText: "Cancelar",
    confirmButtonText: "Sí, eliminar",
    reverseButtons: true,
  });

export { Swal };
