-- Seed de los 22 participantes REALES (generado desde CEDULAS Y SEDES.xlsx).
-- Idempotente: recarga los datos base sin tocar firmas ya hechas.
insert into participantes (cedula, puesto_lista, nombre_completo, sede_opcion_a, sede_opcion_b) values
  ('80197324', 1, 'DI GENNARO MUÑOZ PIERO PAOLO', 'Medellín - Antioquia', 'Manizales - Caldas'),
  ('1026250766', 2, 'ROSERO DIAZ DEL CASTILLO SANTIAGO', 'Pasto Nariño', null),
  ('53000980', 3, 'AGUIRRE GARCÍA SANDRA LILIANA', 'Bucaramanga - Santander', null),
  ('11443854', 4, 'RAMÍREZ SIERRA DIEGO FERNANDO', 'Bucaramanga - Santander', null),
  ('36951991', 5, 'ROSERO DIAZ DEL CASTILLO CATALINA', 'Manizales - Caldas', 'Bucaramanga - Santander'),
  ('1085245321', 6, 'CARDENAS CAYCEDO OMAR ALFONSO', 'Bucaramanga - Santander', null),
  ('98399720', 7, 'VALLEJO GOYES JOSE ALFREDO', 'Manizales - Caldas', 'Ibagué - Tolima'),
  ('30330591', 8, 'TORO DUQUE ELIANA MARIA', 'Bucaramanga - Santander', 'Manizales - Caldas'),
  ('30404151', 9, 'LOPEZ AGUIRRE DIANA MARIA', 'Ibagué - Tolima', 'Manizales - Caldas'),
  ('65633295', 10, 'ARANA FRANCO DIANA CAROLINA', 'Ibagué - Tolima', 'Bucaramanga - Santander'),
  ('98481740', 11, 'LONDOÑO BRAND WILLIAM FERNANDO', 'Bucaramanga - Santander', 'Medellín - Antioquia'),
  ('39728479', 12, 'ACOSTA JARA BRIYIT ROCIO', 'Villavicencio - Meta', 'Bucaramanga - Santander'),
  ('1032358580', 13, 'BUCHELI BUCHELI JAVIER ARMANDO', 'Bucaramanga - Santander', 'Barranquilla - Atlántico'),
  ('43839746', 14, 'ARANGO ECHEVERRI MARIA ANDREA', 'Ibagué - Tolima', 'Cartagena - Bolívar'),
  ('38360456', 15, 'HUNTER HERNANDEZ MARTHA CECILIA', 'Cartagena - Bolívar', 'Ibagué - Tolima'),
  ('79556024', 16, 'ARCE CAICEDO EDUARDO', 'Barranquilla - Atlántico', 'Villavicencio - Meta'),
  ('12144883', 17, 'POLANCO LOPEZ HUGO ARMANDO', 'Villavicencio - Meta', 'Cúcuta - Norte de Santander'),
  ('94481568', 18, 'GOMEZ MORENO JOHNNIFER', 'Cúcuta - Norte de Santander', null),
  ('79591306', 19, 'CAMACHO PUYO JOHN CARLOS', 'Barranquilla - Atlántico', 'Cúcuta - Norte de Santander'),
  ('1061709336', 20, 'VALENCIA BONILLA GUSTAVO ANDRES', 'Bucaramanga - Santander', 'Cartagena - Bolívar'),
  ('52191995', 21, 'ZULUAGA GIRALDO PAULA ANDREA', 'Bucaramanga - Santander', 'Cúcuta - Norte de Santander'),
  ('91528480', 22, 'LOZANO ARANGO CARLOS ANDRES', 'Cúcuta - Norte de Santander', 'Bucaramanga - Santander')
on conflict (cedula) do update set
  puesto_lista    = excluded.puesto_lista,
  nombre_completo = excluded.nombre_completo,
  sede_opcion_a   = excluded.sede_opcion_a,
  sede_opcion_b   = excluded.sede_opcion_b;
