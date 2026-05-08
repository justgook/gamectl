#ifndef PDK_H
#define PDK_H

#ifndef NULL
#define NULL ((void *)0)
#endif

typedef unsigned char pdk_u8;
typedef unsigned int pdk_u32;
typedef unsigned long long pdk_u64;
typedef int pdk_i32;

static inline pdk_u32 pdk_strlen(const char *str) {
  pdk_u32 len = 0;
  while (str[len] != '\0')
    len++;
  return len;
}

static inline void pdk_memcpy(void *dest, const void *src, pdk_u32 n) {
  pdk_u8 *d = (pdk_u8 *)dest;
  const pdk_u8 *s = (const pdk_u8 *)src;
  for (pdk_u32 i = 0; i < n; i++) {
    d[i] = s[i];
  }
}

__attribute__((import_module("env"), import_name("alloc"))) pdk_u32
pdk_alloc(pdk_u64 size);

__attribute__((import_module("env"), import_name("free"))) void
pdk_free(pdk_u32 ptr);

__attribute__((import_module("env"), import_name("input_ptr"))) pdk_u32
pdk_input_ptr(void);

__attribute__((import_module("env"), import_name("input_len"))) pdk_u32
pdk_input_len(void);

__attribute__((import_module("env"), import_name("set_output"))) void
pdk_set_output(pdk_u32 ptr, pdk_u32 len);

__attribute__((import_module("env"), import_name("plugin_call"))) pdk_u32
pdk_plugin_call(pdk_u32 module_ptr, pdk_u32 module_len, pdk_u32 func_ptr,
                pdk_u32 func_len, pdk_u32 input_ptr, pdk_u32 input_len);

__attribute__((import_module("env"), import_name("plugin_call_return"))) pdk_i32
pdk_plugin_call_return(void);

__attribute__((import_module("env"), import_name("plugin_call_output_ptr"))) pdk_u32
pdk_plugin_call_output_ptr(void);

__attribute__((import_module("env"), import_name("plugin_call_output_len"))) pdk_u32
pdk_plugin_call_output_len(void);

static inline const pdk_u8 *pdk_input(pdk_u32 *out_len) {
  pdk_u32 ptr = pdk_input_ptr();
  pdk_u32 len = pdk_input_len();
  if (out_len)
    *out_len = len;
  return (const pdk_u8 *)ptr;
}

static inline void pdk_output(const pdk_u8 *data, pdk_u32 len) {
  pdk_u32 out_ptr = pdk_alloc(len);
  pdk_u8 *out_buf = (pdk_u8 *)out_ptr;
  if (len > 0 && out_ptr == 0) {
    return;
  }
  pdk_memcpy(out_buf, data, len);
  pdk_set_output(out_ptr, len);
}

typedef struct {
  pdk_i32 return_code;
  const pdk_u8 *output;
  pdk_u32 output_len;
  pdk_i32 error;
} pdk_call_result_t;

static inline pdk_call_result_t
pdk_call(const char *module, pdk_u32 module_len, const char *function,
         pdk_u32 func_len, const pdk_u8 *input, pdk_u32 input_len) {
  pdk_call_result_t result = {0};
  pdk_u32 module_ptr = pdk_alloc(module_len);
  pdk_u32 func_ptr = pdk_alloc(func_len);
  pdk_u32 input_ptr = 0;

  if ((module_len > 0 && module_ptr == 0) || (func_len > 0 && func_ptr == 0)) {
    result.error = -1;
    if (module_ptr != 0) {
      pdk_free(module_ptr);
    }
    if (func_ptr != 0) {
      pdk_free(func_ptr);
    }
    return result;
  }

  pdk_memcpy((void *)module_ptr, module, module_len);
  pdk_memcpy((void *)func_ptr, function, func_len);

  if (input_len > 0 && input != NULL) {
    input_ptr = pdk_alloc(input_len);
    if (input_ptr == 0) {
      result.error = -1;
      pdk_free(module_ptr);
      pdk_free(func_ptr);
      return result;
    }
    pdk_memcpy((void *)input_ptr, input, input_len);
  }

  pdk_u32 call_result = pdk_plugin_call(module_ptr, module_len, func_ptr,
                                        func_len, input_ptr, input_len);

  pdk_free(module_ptr);
  pdk_free(func_ptr);
  if (input_ptr != 0) {
    pdk_free(input_ptr);
  }

  if (call_result != 0) {
    result.error = (pdk_i32)call_result;
    return result;
  }

  result.return_code = pdk_plugin_call_return();
  result.output = (const pdk_u8 *)pdk_plugin_call_output_ptr();
  result.output_len = pdk_plugin_call_output_len();
  result.error = 0;

  return result;
}

static inline pdk_call_result_t pdk_call_str(const char *module,
                                             const char *function,
                                             const pdk_u8 *input,
                                             pdk_u32 input_len) {
  return pdk_call(module, pdk_strlen(module), function, pdk_strlen(function),
                  input, input_len);
}

static inline pdk_call_result_t pdk_call_plugin(const char *plugin,
                                                pdk_u32 plugin_len,
                                                const char *function,
                                                pdk_u32 func_len,
                                                const pdk_u8 *input,
                                                pdk_u32 input_len) {
  return pdk_call(plugin, plugin_len, function, func_len, input, input_len);
}

static inline pdk_call_result_t pdk_call_plugin_str(const char *plugin,
                                                    const char *function,
                                                    const pdk_u8 *input,
                                                    pdk_u32 input_len) {
  return pdk_call_str(plugin, function, input, input_len);
}

static inline pdk_call_result_t pdk_call_host(const char *function,
                                              pdk_u32 func_len,
                                              const pdk_u8 *input,
                                              pdk_u32 input_len) {
  return pdk_call("host", 4, function, func_len, input, input_len);
}

static inline pdk_call_result_t pdk_call_host_str(const char *function,
                                                  const pdk_u8 *input,
                                                  pdk_u32 input_len) {
  return pdk_call("host", 4, function, pdk_strlen(function), input, input_len);
}

#endif
