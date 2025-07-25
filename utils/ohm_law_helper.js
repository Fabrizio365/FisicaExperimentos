/**
 * Funciones auxiliares para cálculos de Ley de Ohm, potencia y análisis eléctrico
 * Proporciona métodos especializados para diferentes tipos de componentes
 */
class OhmLawHelper {
    constructor() {
        this.tolerance = 1e-12;
        this.constants = {
            // Constantes físicas
            ELECTRON_CHARGE: 1.602176634e-19, // Coulombs
            BOLTZMANN_CONSTANT: 1.380649e-23, // J/K
            VACUUM_PERMEABILITY: 4 * Math.PI * 1e-7, // H/m
            VACUUM_PERMITTIVITY: 8.8541878128e-12, // F/m
            
            // Constantes de materiales comunes
            COPPER_RESISTIVITY: 1.68e-8, // Ω⋅m a 20°C
            ALUMINUM_RESISTIVITY: 2.65e-8, // Ω⋅m a 20°C
            SILVER_RESISTIVITY: 1.59e-8, // Ω⋅m a 20°C
            
            // Temperaturas de referencia
            ROOM_TEMPERATURE: 293.15, // K (20°C)
            ABSOLUTE_ZERO: 0, // K
            
            // Factores de conversión
            MILLI: 1e-3,
            MICRO: 1e-6,
            NANO: 1e-9,
            PICO: 1e-12,
            KILO: 1e3,
            MEGA: 1e6,
            GIGA: 1e9
        };
    }

    /**
     * Análisis completo de potencia del circuito
     */
    calculatePowerAnalysis(results, circuit) {
        const powerAnalysis = {
            totalSupplied: 0,
            totalDissipated: 0,
            totalStored: 0,
            totalUseful: 0,
            efficiency: 0,
            powerFactor: 1,
            componentPowers: {},
            powerBalance: 0,
            thermalAnalysis: {},
            losses: {
                resistive: 0,
                switching: 0,
                core: 0,
                other: 0
            }
        };

        // Analizar potencia de cada componente
        Object.entries(results.componentValues).forEach(([componentId, values]) => {
            const component = circuit.components.find(c => c.id === componentId);
            if (!component) return;

            const power = this.calculateComponentPowerAnalysis(component, values);
            powerAnalysis.componentPowers[componentId] = power;

            // Clasificar potencias
            switch (component.type) {
                case 'voltage':
                case 'current':
                    if (power.instantaneous > 0) {
                        powerAnalysis.totalSupplied += power.instantaneous;
                    }
                    break;

                case 'resistor':
                    powerAnalysis.totalDissipated += power.instantaneous;
                    powerAnalysis.losses.resistive += power.instantaneous;
                    break;

                case 'capacitor':
                case 'inductor':
                    powerAnalysis.totalStored += Math.abs(power.stored || 0);
                    break;

                default:
                    powerAnalysis.totalDissipated += Math.abs(power.instantaneous);
                    powerAnalysis.losses.other += Math.abs(power.instantaneous);
            }
        });

        // Calcular potencia útil (suministrada - pérdidas)
        powerAnalysis.totalUseful = powerAnalysis.totalSupplied - powerAnalysis.totalDissipated;

        // Calcular eficiencia
        if (powerAnalysis.totalSupplied > 0) {
            powerAnalysis.efficiency = (powerAnalysis.totalUseful / powerAnalysis.totalSupplied) * 100;
        }

        // Balance de potencia (debe ser cercano a cero)
        powerAnalysis.powerBalance = Math.abs(powerAnalysis.totalSupplied - powerAnalysis.totalDissipated - powerAnalysis.totalStored);

        // Análisis térmico
        powerAnalysis.thermalAnalysis = this.calculateThermalAnalysis(circuit, powerAnalysis);

        return powerAnalysis;
    }

    /**
     * Análisis de potencia específico por componente
     */
    calculateComponentPowerAnalysis(component, values) {
        const analysis = {
            instantaneous: values.power || 0,
            average: values.power || 0,
            peak: values.power || 0,
            rms: values.power || 0,
            stored: 0,
            dissipated: 0,
            efficiency: 100,
            powerDensity: 0,
            thermal: {}
        };

        const voltage = values.voltage || 0;
        const current = values.current || 0;

        switch (component.type) {
            case 'resistor':
                analysis.dissipated = analysis.instantaneous;
                analysis.thermal = this.calculateResistorThermal(component, analysis.dissipated);
                break;

            case 'capacitor':
                analysis.stored = 0.5 * component.value * voltage * voltage;
                analysis.dissipated = 0; // Capacitor ideal
                break;

            case 'inductor':
                analysis.stored = 0.5 * component.value * current * current;
                analysis.dissipated = 0; // Inductor ideal
                break;

            case 'voltage':
            case 'current':
                analysis.efficiency = component.efficiency || 95;
                analysis.dissipated = analysis.instantaneous * (1 - analysis.efficiency / 100);
                break;
        }

        // Densidad de potencia (si hay información física)
        if (component.physicalSize) {
            analysis.powerDensity = analysis.instantaneous / component.physicalSize;
        }

        return analysis;
    }

    /**
     * Análisis térmico de resistores
     */
    calculateResistorThermal(resistor, power) {
        const thermal = {
            temperature: 25, // Temperatura ambiente por defecto
            temperatureRise: 0,
            thermalResistance: 250, // °C/W típico para resistor estándar
            derating: 1,
            maxSafePower: resistor.powerRating || 0.25
        };

        // Calcular elevación de temperatura
        thermal.temperatureRise = power * thermal.thermalResistance;
        thermal.temperature = 25 + thermal.temperatureRise;

        // Calcular derating por temperatura
        if (thermal.temperature > 70) {
            thermal.derating = Math.max(0, 1 - (thermal.temperature - 70) / 100);
        }

        // Potencia máxima segura considerando derating
        thermal.maxSafePower = thermal.maxSafePower * thermal.derating;

        return thermal;
    }

    /**
     * Análisis térmico general del circuito
     */
    calculateThermalAnalysis(circuit, powerAnalysis) {
        const thermal = {
            totalHeat: powerAnalysis.totalDissipated,
            hotspots: [],
            averageTemperature: 25,
            maxTemperature: 25,
            coolingRequired: 0,
            thermalTimeConstant: 0
        };

        // Identificar puntos calientes
        Object.entries(powerAnalysis.componentPowers).forEach(([componentId, power]) => {
            const component = circuit.components.find(c => c.id === componentId);
            if (component && power.thermal && power.thermal.temperature > 60) {
                thermal.hotspots.push({
                    componentId: componentId,
                    componentLabel: component.label,
                    temperature: power.thermal.temperature,
                    power: power.instantaneous
                });
            }
        });

        // Temperatura máxima
        thermal.maxTemperature = Math.max(25, ...thermal.hotspots.map(h => h.temperature));

        // Refrigeración requerida (simplificado)
        if (thermal.totalHeat > 1) { // > 1W
            thermal.coolingRequired = thermal.totalHeat * 0.1; // 10% como estimación
        }

        return thermal;
    }

    /**
     * Valida el balance de potencia (Ley de conservación de energía)
     */
    validatePowerBalance(powerAnalysis) {
        const tolerance = 0.01; // 1% de tolerancia
        const totalInput = powerAnalysis.totalSupplied;
        const totalOutput = powerAnalysis.totalDissipated + powerAnalysis.totalStored;
        
        const error = Math.abs(totalInput - totalOutput);
        const relativeError = totalInput > 0 ? (error / totalInput) * 100 : 0;

        return {
            isValid: relativeError < tolerance * 100,
            error: error,
            relativeError: relativeError,
            tolerance: tolerance,
            input: totalInput,
            output: totalOutput
        };
    }

    /**
     * Calcula parámetros RMS para señales periódicas
     */
    calculateRMSValues(waveformData) {
        if (!waveformData || waveformData.length === 0) {
            return { voltage: 0, current: 0, power: 0 };
        }

        const n = waveformData.length;
        let voltageSquaredSum = 0;
        let currentSquaredSum = 0;
        let powerSum = 0;

        waveformData.forEach(point => {
            voltageSquaredSum += (point.voltage || 0) ** 2;
            currentSquaredSum += (point.current || 0) ** 2;
            powerSum += (point.voltage || 0) * (point.current || 0);
        });

        return {
            voltage: Math.sqrt(voltageSquaredSum / n),
            current: Math.sqrt(currentSquaredSum / n),
            power: powerSum / n
        };
    }

    /**
     * Calcula factor de potencia
     */
    calculatePowerFactor(voltage, current, phase = 0) {
        // Factor de potencia = cos(φ)
        return Math.cos(phase);
    }

    /**
     * Análisis de armónicos de potencia
     */
    calculatePowerHarmonics(fundamentalPower, harmonics) {
        const analysis = {
            fundamental: fundamentalPower,
            harmonics: [],
            totalHarmonicDistortion: 0,
            totalPower: fundamentalPower
        };

        if (harmonics && harmonics.length > 0) {
            let harmonicPowerSum = 0;

            harmonics.forEach(harmonic => {
                const harmonicPower = harmonic.amplitude ** 2 / 2; // Potencia RMS
                analysis.harmonics.push({
                    order: harmonic.order,
                    power: harmonicPower,
                    percentage: (harmonicPower / fundamentalPower) * 100
                });
                harmonicPowerSum += harmonicPower;
            });

            analysis.totalPower += harmonicPowerSum;
            analysis.totalHarmonicDistortion = Math.sqrt(harmonicPowerSum / fundamentalPower) * 100;
        }

        return analysis;
    }

    /**
     * Calcula energía consumida en un período
     */
    calculateEnergy(power, timeHours) {
        return {
            joules: power * timeHours * 3600, // P × t (en segundos)
            watthours: power * timeHours,
            kilowatthours: (power * timeHours) / 1000
        };
    }

    /**
     * Análisis de eficiencia de conversión
     */
    calculateConversionEfficiency(inputPower, outputPower, losses = {}) {
        const efficiency = {
            overall: 0,
            breakdown: {
                conduction: 100,
                switching: 100,
                core: 100,
                other: 100
            },
            losses: {
                conduction: losses.conduction || 0,
                switching: losses.switching || 0,
                core: losses.core || 0,
                other: losses.other || 0
            }
        };

        if (inputPower > 0) {
            efficiency.overall = (outputPower / inputPower) * 100;

            // Desglose de eficiencias
            Object.keys(efficiency.losses).forEach(lossType => {
                const loss = efficiency.losses[lossType];
                efficiency.breakdown[lossType] = ((inputPower - loss) / inputPower) * 100;
            });
        }

        return efficiency;
    }

    /**
     * Cálculo de ruido térmico (Johnson noise)
     */
    calculateThermalNoise(resistance, temperature, bandwidth) {
        // Voltaje RMS de ruido térmico: V_n = sqrt(4kTRB)
        const k = this.constants.BOLTZMANN_CONSTANT;
        const T = temperature + 273.15; // Convertir a Kelvin
        const R = resistance;
        const B = bandwidth;

        const noiseVoltage = Math.sqrt(4 * k * T * R * B);
        const noisePower = (noiseVoltage ** 2) / R;

        return {
            voltageRMS: noiseVoltage,
            voltagePeakToPeak: noiseVoltage * 6.6, // Aproximación para distribución gaussiana
            power: noisePower,
            temperature: temperature,
            bandwidth: bandwidth
        };
    }

    /**
     * Análisis de transientes de potencia
     */
    calculateTransientPower(component, initialConditions, timeConstant, time) {
        const analysis = {
            instantaneous: 0,
            peak: 0,
            steadyState: 0,
            timeToSteadyState: 0,
            overshoot: 0
        };

        switch (component.type) {
            case 'capacitor':
                // P(t) = V²/R × e^(-2t/RC) para carga/descarga
                const RC = timeConstant;
                const V = initialConditions.voltage || 0;
                const R = initialConditions.resistance || 1;
                
                analysis.instantaneous = (V * V / R) * Math.exp(-2 * time / RC);
                analysis.peak = V * V / R;
                analysis.timeToSteadyState = 5 * RC; // 5 constantes de tiempo
                break;

            case 'inductor':
                // P(t) = I²R × (1 - e^(-t/τ))² para energización
                const L_R = timeConstant;
                const I = initialConditions.current || 0;
                const R_L = initialConditions.resistance || 1;
                
                const exponential = Math.exp(-time / L_R);
                analysis.instantaneous = I * I * R_L * (1 - exponential) ** 2;
                analysis.peak = I * I * R_L;
                analysis.timeToSteadyState = 5 * L_R;
                break;
        }

        return analysis;
    }

    /**
     * Convierte unidades de potencia
     */
    convertPowerUnits(value, fromUnit, toUnit) {
        const powerUnits = {
            'W': 1,
            'mW': 1e-3,
            'µW': 1e-6,
            'nW': 1e-9,
            'kW': 1e3,
            'MW': 1e6,
            'GW': 1e9,
            'hp': 745.7, // Caballos de fuerza
            'BTU/h': 0.293071 // BTU por hora
        };

        const fromFactor = powerUnits[fromUnit] || 1;
        const toFactor = powerUnits[toUnit] || 1;

        return value * fromFactor / toFactor;
    }

    /**
     * Formatea valores de potencia para visualización
     */
    formatPowerValue(value, precision = 3) {
        if (Math.abs(value) >= 1e9) {
            return `${(value / 1e9).toFixed(precision)} GW`;
        } else if (Math.abs(value) >= 1e6) {
            return `${(value / 1e6).toFixed(precision)} MW`;
        } else if (Math.abs(value) >= 1e3) {
            return `${(value / 1e3).toFixed(precision)} kW`;
        } else if (Math.abs(value) >= 1) {
            return `${value.toFixed(precision)} W`;
        } else if (Math.abs(value) >= 1e-3) {
            return `${(value * 1e3).toFixed(precision)} mW`;
        } else if (Math.abs(value) >= 1e-6) {
            return `${(value * 1e6).toFixed(precision)} µW`;
        } else if (Math.abs(value) >= 1e-9) {
            return `${(value * 1e9).toFixed(precision)} nW`;
        } else {
            return `${value.toExponential(precision)} W`;
        }
    }

    /**
     * Calcula resistencia desde código de colores
     */
    calculateResistanceFromColorCode(colors) {
        const colorValues = {
            'black': 0, 'brown': 1, 'red': 2, 'orange': 3,
            'yellow': 4, 'green': 5, 'blue': 6, 'violet': 7,
            'grey': 8, 'gray': 8, 'white': 9
        };

        const toleranceValues = {
            'brown': 1, 'red': 2, 'green': 0.5, 'blue': 0.25,
            'violet': 0.1, 'grey': 0.05, 'gray': 0.05, 'gold': 5, 'silver': 10
        };

        if (colors.length < 3) {
            throw new Error('Se requieren al menos 3 colores para calcular resistencia');
        }

        let value = 0;
        let multiplier = 1;
        let tolerance = 5; // Por defecto 5%

        if (colors.length === 3) {
            // Resistor de 3 bandas
            value = colorValues[colors[0]] * 10 + colorValues[colors[1]];
            multiplier = Math.pow(10, colorValues[colors[2]]);
        } else if (colors.length === 4) {
            // Resistor de 4 bandas
            value = colorValues[colors[0]] * 10 + colorValues[colors[1]];
            multiplier = Math.pow(10, colorValues[colors[2]]);
            tolerance = toleranceValues[colors[3]] || 5;
        } else if (colors.length === 5) {
            // Resistor de 5 bandas (precisión)
            value = colorValues[colors[0]] * 100 + colorValues[colors[1]] * 10 + colorValues[colors[2]];
            multiplier = Math.pow(10, colorValues[colors[3]]);
            tolerance = toleranceValues[colors[4]] || 1;
        }

        const resistance = value * multiplier;

        return {
            value: resistance,
            tolerance: tolerance,
            minValue: resistance * (1 - tolerance / 100),
            maxValue: resistance * (1 + tolerance / 100)
        };
    }

    /**
     * Calcula código de colores desde valor de resistencia
     */
    calculateColorCodeFromResistance(resistance) {
        const colors = [
            'black', 'brown', 'red', 'orange', 'yellow',
            'green', 'blue', 'violet', 'grey', 'white'
        ];

        if (resistance < 1 || resistance >= 1e12) {
            throw new Error('Valor de resistencia fuera de rango');
        }

        let value = resistance;
        let multiplier = 0;

        // Normalizar a 2-3 dígitos significativos
        while (value >= 100 && multiplier < 9) {
            value /= 10;
            multiplier++;
        }

        const digit1 = Math.floor(value / 10);
        const digit2 = Math.floor(value % 10);

        return {
            colors: [colors[digit1], colors[digit2], colors[multiplier]],
            value: resistance,
            representation: `${colors[digit1]}-${colors[digit2]}-${colors[multiplier]}`
        };
    }

    /**
     * Convierte entre diferentes unidades eléctricas
     */
    convertElectricalUnits(value, fromUnit, toUnit, type = 'resistance') {
        const units = {
            resistance: {
                'Ω': 1, 'ohm': 1, 'ohms': 1,
                'kΩ': 1e3, 'kilohm': 1e3, 'kilohms': 1e3,
                'MΩ': 1e6, 'megohm': 1e6, 'megohms': 1e6
            },
            voltage: {
                'V': 1, 'volt': 1, 'volts': 1,
                'mV': 1e-3, 'millivolt': 1e-3, 'millivolts': 1e-3,
                'kV': 1e3, 'kilovolt': 1e3, 'kilovolts': 1e3
            },
            current: {
                'A': 1, 'amp': 1, 'amps': 1, 'ampere': 1, 'amperes': 1,
                'mA': 1e-3, 'milliamp': 1e-3, 'milliamps': 1e-3,
                'µA': 1e-6, 'microamp': 1e-6, 'microamps': 1e-6,
                'nA': 1e-9, 'nanoamp': 1e-9, 'nanoamps': 1e-9
            },
            capacitance: {
                'F': 1, 'farad': 1, 'farads': 1,
                'mF': 1e-3, 'millifarad': 1e-3,
                'µF': 1e-6, 'microfarad': 1e-6,
                'nF': 1e-9, 'nanofarad': 1e-9,
                'pF': 1e-12, 'picofarad': 1e-12
            },
            inductance: {
                'H': 1, 'henry': 1, 'henries': 1,
                'mH': 1e-3, 'millihenry': 1e-3,
                'µH': 1e-6, 'microhenry': 1e-6,
                'nH': 1e-9, 'nanohenry': 1e-9
            }
        };

        const unitSet = units[type];
        if (!unitSet) {
            throw new Error(`Tipo de unidad no soportado: ${type}`);
        }

        const fromFactor = unitSet[fromUnit];
        const toFactor = unitSet[toUnit];

        if (fromFactor === undefined || toFactor === undefined) {
            throw new Error(`Unidad no reconocida: ${fromUnit} o ${toUnit}`);
        }

        return value * fromFactor / toFactor;
    }
}
     * Calcula voltaje usando la Ley de Ohm: V = I × R
     */
    calculateVoltage(component, current) {
        if (!component || typeof current !== 'number') {
            throw new Error('Parámetros inválidos para cálculo de voltaje');
        }

        switch (component.type) {
            case 'resistor':
                return this.calculateResistorVoltage(component, current);
            
            case 'capacitor':
                return this.calculateCapacitorVoltage(component, current);
            
            case 'inductor':
                return this.calculateInductorVoltage(component, current);
            
            case 'diode':
                return this.calculateDiodeVoltage(component, current);
            
            case 'voltage':
                return component.value; // Fuente de voltaje ideal
            
            case 'current':
                return 0; // Fuente de corriente ideal (voltaje determinado por circuito)
            
            default:
                return Math.abs(current) * (component.value || 0);
        }
    }

    /**
     * Calcula corriente usando la Ley de Ohm: I = V / R
     */
    calculateCurrent(component, voltage) {
        if (!component || typeof voltage !== 'number') {
            throw new Error('Parámetros inválidos para cálculo de corriente');
        }

        switch (component.type) {
            case 'resistor':
                return this.calculateResistorCurrent(component, voltage);
            
            case 'capacitor':
                return this.calculateCapacitorCurrent(component, voltage);
            
            case 'inductor':
                return this.calculateInductorCurrent(component, voltage);
            
            case 'diode':
                return this.calculateDiodeCurrent(component, voltage);
            
            case 'voltage':
                return 0; // Corriente determinada por el circuito
            
            case 'current':
                return component.value; // Fuente de corriente ideal
            
            default:
                const resistance = component.value || Infinity;
                return resistance > this.tolerance ? voltage / resistance : 0;
        }
    }

    /**
     * Calcula potencia: P = V × I = I² × R = V² / R
     */
    calculatePower(voltage, current, component = null) {
        if (typeof voltage !== 'number' || typeof current !== 'number') {
            throw new Error('Parámetros inválidos para cálculo de potencia');
        }

        const powerVI = Math.abs(voltage * current);
        
        if (!component) {
            return powerVI;
        }

        // Cálculos específicos por tipo de componente
        switch (component.type) {
            case 'resistor':
                return this.calculateResistorPower(component, voltage, current);
            
            case 'capacitor':
                return this.calculateCapacitorPower(component, voltage, current);
            
            case 'inductor':
                return this.calculateInductorPower(component, voltage, current);
            
            case 'diode':
                return this.calculateDiodePower(component, voltage, current);
            
            case 'voltage':
                // Potencia suministrada por fuente de voltaje
                return voltage * current;
            
            case 'current':
                // Potencia suministrada por fuente de corriente
                return voltage * current;
            
            default:
                return powerVI;
        }
    }

    /**
     * Calcula impedancia compleja de un componente
     */
    calculateImpedance(component, frequency = 0) {
        if (!component) {
            return { real: 0, imaginary: 0 };
        }

        const omega = 2 * Math.PI * frequency;

        switch (component.type) {
            case 'resistor':
                return {
                    real: component.value,
                    imaginary: 0
                };
            
            case 'capacitor':
                if (frequency === 0) {
                    return { real: Infinity, imaginary: 0 };
                }
                const Xc = -1 / (omega * component.value);
                return {
                    real: 0,
                    imaginary: Xc
                };
            
            case 'inductor':
                const XL = omega * component.value;
                return {
                    real: 0,
                    imaginary: XL
                };
            
            case 'diode':
                return this.calculateDiodeImpedance(component, frequency);
            
            case 'voltage':
            case 'current':
                return {
                    real: component.internalResistance || 0,
                    imaginary: 0
                };
            
            default:
                return {
                    real: component.value || 0,
                    imaginary: 0
                };
        }
    }

    /**
     * Cálculos específicos para resistores
     */
    calculateResistorVoltage(resistor, current) {
        const effectiveResistance = this.getEffectiveResistance(resistor);
        return current * effectiveResistance;
    }

    calculateResistorCurrent(resistor, voltage) {
        const effectiveResistance = this.getEffectiveResistance(resistor);
        return effectiveResistance > this.tolerance ? voltage / effectiveResistance : 0;
    }

    calculateResistorPower(resistor, voltage, current) {
        const effectiveResistance = this.getEffectiveResistance(resistor);
        
        // Usar la fórmula más precisa según los datos disponibles
        if (Math.abs(current) > this.tolerance) {
            return current * current * effectiveResistance; // P = I²R
        } else if (Math.abs(voltage) > this.tolerance) {
            return voltage * voltage / effectiveResistance; // P = V²/R
        } else {
            return Math.abs(voltage * current); // P = VI
        }
    }

    /**
     * Obtiene resistencia efectiva considerando temperatura
     */
    getEffectiveResistance(resistor) {
        let baseResistance = resistor.value;
        
        // Considerar efectos de temperatura si están disponibles
        if (resistor.temperature !== undefined && resistor.tempCoefficient !== undefined) {
            const tempDelta = resistor.temperature - 25; // Referencia a 25°C
            const tempFactor = 1 + (resistor.tempCoefficient * tempDelta / 1000000);
            baseResistance *= tempFactor;
        }
        
        // Considerar posición del tap si es variable
        if (resistor.isVariable && resistor.tapPosition !== undefined) {
            baseResistance *= resistor.tapPosition;
        }
        
        return baseResistance;
    }

    /**
     * Cálculos específicos para capacitores
     */
    calculateCapacitorVoltage(capacitor, current, deltaTime = 1e-3) {
        // Para análisis DC, el capacitor actúa como circuito abierto
        if (Math.abs(current) < this.tolerance) {
            return capacitor.voltage || 0;
        }
        
        // Para análisis transitorio: V = V₀ + (1/C) ∫ I dt
        const deltaV = (current * deltaTime) / capacitor.value;
        return (capacitor.voltage || 0) + deltaV;
    }

    calculateCapacitorCurrent(capacitor, voltage, deltaTime = 1e-3) {
        // Para análisis DC estático
        if (deltaTime <= 0) return 0;
        
        // I = C × dV/dt
        const previousVoltage = capacitor.voltage || 0;
        const deltaV = voltage - previousVoltage;
        return capacitor.value * (deltaV / deltaTime);
    }

    calculateCapacitorPower(capacitor, voltage, current) {
        // En capacitores ideales, la potencia promedio es cero
        // Potencia instantánea: P = V × I
        return voltage * current;
    }

    /**
     * Cálculos específicos para inductores
     */
    calculateInductorVoltage(inductor, current, deltaTime = 1e-3) {
        // Para análisis DC, el inductor actúa como cortocircuito
        if (Math.abs(current - (inductor.current || 0)) < this.tolerance) {
            return 0;
        }
        
        // V = L × dI/dt
        const previousCurrent = inductor.current || 0;
        const deltaI = current - previousCurrent;
        return inductor.value * (deltaI / deltaTime);
    }

    calculateInductorCurrent(inductor, voltage, deltaTime = 1e-3) {
        // Para análisis DC estático
        if (deltaTime <= 0) return inductor.current || 0;
        
        // I = I₀ + (1/L) ∫ V dt
        const deltaI = (voltage * deltaTime) / inductor.value;
        return (inductor.current || 0) + deltaI;
    }

    calculateInductorPower(inductor, voltage, current) {
        // En inductores ideales, la potencia promedio es cero
        // Potencia instantánea: P = V × I
        return voltage * current;
    }

    /**
     * Cálculos específicos para diodos
     */
    calculateDiodeVoltage(diode, current) {
        // Modelo simplificado del diodo: V = Vf + I × Rs
        const forwardVoltage = diode.forwardVoltage || 0.7; // Voltaje directo típico
        const seriesResistance = diode.forwardResistance || 0.1; // Resistencia serie
        
        if (current > 0) {
            return forwardVoltage + current * seriesResistance;
        } else {
            // Corriente inversa (modelo simplificado)
            return current * (diode.reverseResistance || 1e6);
        }
    }

    calculateDiodeCurrent(diode, voltage) {
        const forwardVoltage = diode.forwardVoltage || 0.7;
        const seriesResistance = diode.forwardResistance || 0.1;
        
        if (voltage > forwardVoltage) {
            // Región directa
            return (voltage - forwardVoltage) / seriesResistance;
        } else {
            // Región inversa (corriente de saturación)
            return diode.saturationCurrent || 1e-12;
        }
    }

    calculateDiodePower(diode, voltage, current) {
        return Math.abs(voltage * current);
    }

    calculateDiodeImpedance(diode, frequency) {
        // Modelo simplificado: resistencia dinámica
        const dynamicResistance = diode.forwardResistance || 0.1;
        return {
            real: dynamicResistance,
            imaginary: 0
        };
    }

    /**
     *