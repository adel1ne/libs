// Интерфейсы для типизации
export interface FieldMapping {
    type: 'string' | 'number' | 'boolean';
    mapTo: string;
    required?: boolean;
    defaultValue?: any;
}

// export interface ExtraFieldMapping {
//     type: 'string' | 'number' | 'boolean' | 'date';
//     value: any;
// }
export interface JsonMapper {
    objectsArray: string; // JSONPath для массива объектов
    fieldsMapping?: Record<string, FieldMapping>;
    // extraFields?: Record<string, ExtraFieldMapping>;
    validation?: {
      minArrayLength?: number;
      requiredPaths?: string[];
    };
  }
  
export interface MappedResult {
    [key: string]: string | number | boolean;
}
  