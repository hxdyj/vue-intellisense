let replaceInFiles =  require('replace-in-files')
export async function filePathsToVeturJsonData(
  inputPaths: string[]
){
  return (await replaceInFiles({
    files:inputPaths,
    from:/directives*\(('|").+('|")(,|\))/g,
  })).matchs  as unknown as Array<string>
}
