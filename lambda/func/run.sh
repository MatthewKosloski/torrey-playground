#!/bin/bash

display_usage () {
	echo "This is usage info!"
}

parse_argument() {
	# Check if the argument to $1 is
	# not null and doesn't start with a "-"
	if [ -n "$2" ] && [ ${2:0:1} != "-" ]; then
		echo "$2"
	else
		>&2 echo "$(basename -- "$0") $1"
		return 1
	fi
}

# Holds the Torrey compiler flags.
declare -a flags

# Loop through all of the CLI arguments and save their
# values to global variables. The currently examined 
# argument is stored in $1 and $2 is the value supplied
# to the argument.
while (( "$#" )); do
	case "$1" in
		--help|-h)
			display_usage
			shift
			# Quit successfully after displaying usage info.
			exit 70
			;;
  	    --version)
			if ! semanticVersion="$(parse_argument "$1" "$2")"; then
				exit 70
			else
				shift 2
			fi
            ;;
		--program)
			if ! program="$(parse_argument "$1" "$2")"; then
				exit 70
			else
				shift 2
			fi
			;;
		--flags)
			if ! flagStr="$(parse_argument "$1" "$2")"; then
				exit 70
			else
				flags=($flagStr)
				shift 2
			fi
			;;
		--temp-dir)
			if ! tmpDir="$(parse_argument "$1" "$2")"; then
				exit 70
			else
				shift 2
			fi
			;;
		--compiler-name)
			if ! compilerFileName="$(parse_argument "$1" "$2")"; then
				exit 70
			else
				shift 2
			fi
			;;
		--compilers-root-dir)
			if ! compilersRootDir="$(parse_argument "$1" "$2")"; then
				exit 70
			else
				shift 2
			fi
			;;
		--compiler-dir)
			if ! compilerDir="$(parse_argument "$1" "$2")"; then
				exit 70
			else
				shift 2
			fi
			;;
		--compiler-path)
			if ! compilerPath="$(parse_argument "$1" "$2")"; then
				exit 70
			else
				shift 2
			fi
			;;
		--runtime-path)
			if ! runtimePath="$(parse_argument "$1" "$2")"; then
				exit 70
			else
				shift 2
			fi
			;;
		--runtime-header-path)
			if ! runtimeHeaderPath="$(parse_argument "$1" "$2")"; then
				exit 70
			else
				shift 2
			fi
			;;
		--asm-path)
			if ! asmPath="$(parse_argument "$1" "$2")"; then
				exit 70
			else
				shift 2
			fi
			;;
		--exec-path)
			if ! execPath="$(parse_argument "$1" "$2")"; then
				exit 70
			else
				shift 2
			fi
			;;
		--obj-code-path)
			if ! objCodePath="$(parse_argument "$1" "$2")"; then
				exit 70
			else
				shift 2
			fi
			;;
		-*|--*=)
			>&2 echo "$(basename -- "$0") $1"
			exit 71
			;;
		*)
			>&2 echo "$(basename -- "$0") $1"
			exit 72
			;;
	esac
done

missingFlags=()
if [ -z "$semanticVersion" ]; then
	missingFlags+=("--version")
fi

if [ -z "$program" ]; then
	missingFlags+=("--program")
fi

if [ -z "$tmpDir" ]; then
	missingFlags+=("--temp-dir")
fi

if [ -z "$compilerFileName" ]; then
	missingFlags+=("--compiler-name")
fi

if [ -z "$compilersRootDir" ]; then
	missingFlags+=("--compilers-root-dir")
fi

if [ -z "$compilerDir" ]; then
	missingFlags+=("--compiler-dir")
fi

if [ -z "$compilerPath" ]; then
	missingFlags+=("--compiler-path")
fi

if [ -z "$runtimePath" ]; then
	missingFlags+=("--runtime-path")
fi

if [ -z "$runtimeHeaderPath" ]; then
	missingFlags+=("--runtime-header-path")
fi

if [ -z "$asmPath" ]; then
	missingFlags+=("--asm-path")
fi

if [ -z "$execPath" ]; then
	missingFlags+=("--exec-path")
fi

if [ -z "$objCodePath" ]; then
	missingFlags+=("--obj-code-path")
fi

if [ "${#missingFlags[@]}" -gt 0 ]; then
	>&2 echo "$(basename -- "$0") ${missingFlags[*]}"
	exit 73
fi

# Now, we will check to make sure that the selected compiler
# and its dependencies are installed and that the compiler can 
# be executed by the Lambda user. Returned status codes will 
# eventually be mapped to error messages by the parent process
# and then sent to the Lambda consumer as 500s.

# Check if the compiler is installed 
# at the expected location.
if [ ! -f "$compilerPath" ]; then
    exit 64
fi

# Check if the compiler runtime is installed 
# at the expected location.
if [ ! -f "$runtimePath" ]; then
    exit 65
fi

# Check if the compiler runtime header is installed 
# at the expected location.
if [ ! -f "$runtimeHeaderPath" ]; then
    exit 66
fi

# Check if we have permission to execute the compiler.
if [ ! -x "$compilerPath" ]; then
    exit 67
fi

# Check if gcc dependency is installed.
if [ "$(type -t gcc)" != "file" ]; then
    exit 68
fi

# Check if jvm dependency is installed.
if [ "$(type -t java)" != "file" ]; then
    exit 69
fi

# Now it's safe to execute the compiler.

# Prefix flag names with hyphens.
count=0
for flag in "${flags[@]}"
do 
  flags[count]="-$flag"
  count=$((count+1))
done

if [ "${#flags[@]}" -ne "0" ]; then
    # There are compiler flags, so just
    # run the compiler with them.
    echo "$program" | java -jar $compilerPath ${flags[@]}
else
    # There aren't any compiler flags, so just
    # compile, assemble, and execute.

    # TODO:
    # Check if we are allowed to write to the assembly file.
    # Check if we are allowed to read from $runtimePath.
    # Check if we are allowed to write to $objCodePath.
    # Check if we are allowed to write to $execPath.
    # Check if we are allowed to execute $execPath.

    echo "$program" | java -jar $compilerPath -S > $asmPath \
        && gcc -c $runtimePath -o $objCodePath \
        && gcc $asmPath $objCodePath -o $execPath \
        && $execPath \
        && rm $asmPath $execPath
    # echo "$asmPath";

    # && gcc -c $runtimePath -o $objCodePath && gcc $asmPath $objCodePath -o $execPath && $execPath && rm $asmPath $execPath 
fi