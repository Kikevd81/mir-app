export const SPECIALTIES = [
    { id: 'med-trabajo', name: 'Medicina del Trabajo', totalSlots: 4 },
    { id: 'cir-cardiovasc', name: 'Cirugía Cardiovascular', totalSlots: 4 },
    { id: 'anestesia', name: 'Anestesiología y Reanimación', totalSlots: 22 },
];

export const HOSPITALS = [
    { id: 'h-santiago', name: 'Complejo Hospitalario Universitario de Santiago', province: 'A Coruña' },
    { id: 'h-vigo', name: 'Complejo Hospitalario Universitario de Vigo', province: 'Pontevedra' },
    { id: 'h-clinico-santiago', name: 'Hospital Clínico Universitario de Santiago', province: 'A Coruña' },
    { id: 'h-jimenez-diaz', name: 'Hospital Fundación Jiménez Díaz', province: 'Madrid' },
    { id: 'h-coruna', name: 'Complejo Hospitalario Universitario de A Coruña', province: 'A Coruña' },
    { id: 'h-clinic-bcn', name: 'Hospital Clínic de Barcelona', province: 'Barcelona' },
    { id: 'h-valencia', name: 'Hospital Clínico Universitario de Valencia', province: 'Valencia' },
];

export const INITIAL_SLOTS = [
    { specialtyId: 'med-trabajo', hospitalId: 'h-santiago', total: 1, available: 1 },
    { specialtyId: 'med-trabajo', hospitalId: 'h-vigo', total: 1, available: 1 },
    { specialtyId: 'med-trabajo', hospitalId: 'h-clinico-santiago', total: 1, available: 1 },
    { specialtyId: 'med-trabajo', hospitalId: 'h-jimenez-diaz', total: 1, available: 1 },

    { specialtyId: 'cir-cardiovasc', hospitalId: 'h-coruna', total: 1, available: 1 },
    { specialtyId: 'cir-cardiovasc', hospitalId: 'h-clinic-bcn', total: 1, available: 1 },
    { specialtyId: 'cir-cardiovasc', hospitalId: 'h-clinico-santiago', total: 1, available: 1 },
    { specialtyId: 'cir-cardiovasc', hospitalId: 'h-valencia', total: 1, available: 1 },

    { specialtyId: 'anestesia', hospitalId: 'h-jimenez-diaz', total: 22, available: 22 },
];
