import { execFile } from "node:child_process";
import { isAbsolute } from "node:path";

/** Rename the verified file object, never replace a path or delete lock bytes. */
export async function retainWindowsWriterLock(path: string, sha256: string, bytes: number): Promise<string> {
  if (process.platform !== "win32" || !isAbsolute(path) || !/^[a-f0-9]{64}$/.test(sha256)
    || !Number.isSafeInteger(bytes) || bytes <= 0 || bytes > 32768) throw new Error("WRITER_RETENTION_INPUT_UNVERIFIED");
  const destination = `${path}.retained-${sha256}`;
  const payload = Buffer.from(JSON.stringify({ path, destination, sha256, bytes })).toString("base64");
  const script = WRITER_RETENTION_SCRIPT.replace("__PAYLOAD__", payload);
  const output = await new Promise<string>((accept, reject) => execFile("powershell.exe",
    ["-NoProfile", "-NonInteractive", "-OutputFormat", "Text", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")],
    { windowsHide: true, timeout: 15000, maxBuffer: 32768, encoding: "utf8" },
    (error, stdout) => error ? reject(new Error("WRITER_RETENTION_UNCONFIRMED")) : accept(stdout.replace(/^\uFEFF/, "").trim())));
  if (output !== "RETAINED") throw new Error("WRITER_RETENTION_UNCONFIRMED");
  return destination;
}

export const WRITER_RETENTION_SCRIPT = String.raw`
$ErrorActionPreference='Stop'
$env:PSModulePath=$PSHOME+'\Modules'
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding $false
$inputData=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('__PAYLOAD__'))|ConvertFrom-Json
Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Win32.SafeHandles;
public static class VerifiedWriterRetention {
 [StructLayout(LayoutKind.Sequential)] struct FileInfo {
  public uint Attributes; public System.Runtime.InteropServices.ComTypes.FILETIME Created,Accessed,Written;
  public uint Volume,SizeHigh,SizeLow,Links,IndexHigh,IndexLow;
 }
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern SafeFileHandle CreateFile(string name,uint access,uint share,IntPtr security,uint disposition,uint flags,IntPtr template);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetFileInformationByHandle(SafeFileHandle h,out FileInfo info);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool SetFileInformationByHandle(SafeFileHandle h,int kind,IntPtr data,uint length);
 public static void Retain(string path,string destination,string expected,long bytes) {
  // DELETE permits rename. Share zero pins the same object against replacement.
  using(var h=CreateFile(path,0x80010000,0,IntPtr.Zero,3,0x00200000,IntPtr.Zero)) {
   if(h.IsInvalid)throw new Win32Exception();
   FileInfo info;if(!GetFileInformationByHandle(h,out info))throw new Win32Exception();
   if((info.Attributes&0x410)!=0 || info.Links!=1 || info.SizeHigh!=0 || info.SizeLow!=bytes)throw new InvalidOperationException("unverified file");
   using(var stream=new FileStream(h,FileAccess.Read,4096,false)) {
    string actual;using(var hash=SHA256.Create())actual=BitConverter.ToString(hash.ComputeHash(stream)).Replace("-","").ToLowerInvariant();
    if(actual!=expected)throw new InvalidOperationException("identity changed");
    byte[] name=Encoding.Unicode.GetBytes(destination);int root=IntPtr.Size==8?8:4;int length=root+IntPtr.Size;int offset=length+4;
    // The Win32 path normalizer also requires a NUL-terminated WCHAR name.
    // FileNameLength excludes that terminator; the allocated buffer must include it.
    int size=offset+name.Length+2;IntPtr buffer=Marshal.AllocHGlobal(size);
    try {
     Marshal.Copy(new byte[size],0,buffer,size);
     // ReplaceIfExists=false, RootDirectory=NULL, exact absolute destination.
     Marshal.WriteInt32(buffer,length,name.Length);Marshal.Copy(name,0,IntPtr.Add(buffer,offset),name.Length);
     if(!SetFileInformationByHandle(h,3,buffer,(uint)size))throw new Win32Exception();
    } finally {Marshal.FreeHGlobal(buffer);}
   }
  }
 }
}
'@
[VerifiedWriterRetention]::Retain([string]$inputData.path,[string]$inputData.destination,[string]$inputData.sha256,[long]$inputData.bytes)
'RETAINED'
`;
